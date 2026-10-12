
import cv2
import mysql.connector
import tkinter as tk
from tkinter import filedialog, messagebox
from pyzbar.pyzbar import decode
from datetime import datetime

# ==========================================
# MYSQL CONFIGURATION - XAMPP
# ==========================================

DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "",  # Set your MySQL password if configured
    "database": "school_bus_safety"
}

READER_ID = "BUS_READER_01"


# ==========================================
# DATABASE CONNECTION
# ==========================================

def get_connection():
    return mysql.connector.connect(**DB_CONFIG)


# ==========================================
# PARSE STUDENT QR / BARCODE
# Expected format:
# ID:1001|NAME:Rahul Sharma|BUS:12|
# STOP:Shankar Nagar|DROP:School Gate|MOBILE:9876543210
# ==========================================


def parse_student_data(raw_data):
    try:
        fields = {}

        for item in raw_data.split("|"):
            key, value = item.split(":", 1)
            fields[key.strip().upper()] = value.strip()

        required = ["ID", "NAME", "BUS", "STOP", "DROP", "MOBILE"]

        if not all(fields.get(key) for key in required):
            return None

        student_id = fields["ID"]

        # Allow letters, numbers, hyphens and underscores
        if not all(
            c.isalnum() or c in "-_"
            for c in student_id
        ):
            return None

        return {
            "student_id": student_id,
            "student_name": fields["NAME"],
            "bus_no": fields["BUS"],
            "bus_stop": fields["STOP"],
            "bus_drop": fields["DROP"],
            "parent_mobile": fields["MOBILE"]
        }

    except (ValueError, AttributeError):
        return None


# ==========================================
# SAVE BUS ENTRY / EXIT IN MYSQL
# ==========================================

def record_attendance(student):
    conn = None
    cursor = None

    try:
        conn = get_connection()
        conn.start_transaction()
        cursor = conn.cursor(dictionary=True)

        # Lock today's latest record for this student
        cursor.execute(
         """
        INSERT INTO attendance_events
        (student_id, bus_no, stop_name, reader_id, BUS_IN)
        VALUES (%s, %s, %s, %s, NOW())
        """,
        (
            student["student_name"],
            student["bus_no"],
            student["bus_stop"],
            READER_ID
        )
)

        record = cursor.fetchone()

        if record is None:
            # First scan today: BUS IN
            cursor.execute(
                """
                INSERT INTO attendance_events
                    (student_id, bus_no, stop_name, reader_id, BUS_IN)
                VALUES (%s, %s, %s, %s, NOW())
                """,
                (
                    student["student_id"],
                    student["bus_no"],
                    student["bus_stop"],
                    READER_ID
                )
            )

            event_type = "BUS IN"
            event_id = cursor.lastrowid

        elif record["BUS_OUT"] is None:
            # Second scan today: BUS OUT
            cursor.execute(
                """
                UPDATE attendance_events
                SET BUS_OUT = NOW(),
                    reader_id = %s
                WHERE event_id = %s
                  AND BUS_OUT IS NULL
                """,
                (READER_ID, record["event_id"])
            )

            if cursor.rowcount != 1:
                conn.rollback()
                return None, "Attendance record changed; please scan again."

            event_type = "BUS OUT"
            event_id = record["event_id"]

        else:
            # Do not overwrite an existing completed attendance cycle
            conn.commit()
            return {
                "event_type": "COMPLETED",
                "event_id": record["event_id"],
                "timestamp": datetime.now().astimezone().isoformat(
                    timespec="seconds"
                )
            }, None

        conn.commit()

        # Read the stored database timestamps
        cursor.execute(
            """
            SELECT BUS_IN, BUS_OUT
            FROM attendance_events
            WHERE event_id = %s
            """,
            (event_id,)
        )
        saved = cursor.fetchone()

        # MySQL DATETIME/TIMESTAMP values are returned as Python datetimes.
        # The displayed value uses the server/database session time zone.
        timestamp = (
            saved["BUS_IN"] if event_type == "BUS IN"
            else saved["BUS_OUT"]
        )

        return {
            "event_type": event_type,
            "event_id": event_id,
            "timestamp": timestamp.isoformat(sep=" ", timespec="seconds")
        }, None

    except mysql.connector.Error as error:
        if conn and conn.in_transaction:
            conn.rollback()

        print("MySQL error:", error)
        return None, str(error)

    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


# ==========================================
# PROCESS A SCANNED CODE
# ==========================================

def process_student(raw_data):
    student = parse_student_data(raw_data)

    if not student:
        messagebox.showerror(
            "Invalid Code",
            "The code does not contain valid student details.\n"
            "Check that the ID is a numeric database student_id."
        )
        return

    result, error = record_attendance(student)

    if error:
        messagebox.showerror(
            "Attendance Database Error",
            "Attendance could not be saved to MySQL.\n\n" + error
        )
        return

    if result["event_type"] == "COMPLETED":
        messagebox.showinfo(
            "Attendance Completed",
            f"Student ID: {student['student_id']}\n"
            f"Name: {student['student_name']}\n\n"
            "This student's entry and exit have already been "
            "recorded for today."
        )
        return

    # Payload for a future API integration
    payload = {
        **student,
        "reader_id": READER_ID,
        "event_id": result["event_id"],
        "event_type": result["event_type"],
        "timestamp": result["timestamp"]
    }

    print("\nAttendance event:")
    print(payload)

    messagebox.showinfo(
        "Attendance Recorded",
        f"Student ID: {student['student_id']}\n"
        f"Student Name: {student['student_name']}\n"
        f"Bus No: {student['bus_no']}\n"
        f"Bus Stop: {student['bus_stop']}\n"
        f"Bus Drop: {student['bus_drop']}\n"
        f"Parent Mobile: {student['parent_mobile']}\n\n"
        f"Attendance: {result['event_type']}\n"
        f"Event ID: {result['event_id']}\n"
        f"Timestamp: {result['timestamp']}"
    )


# ==========================================
# IMPORT QR / BARCODE IMAGE
# ==========================================

def import_image():
    path = filedialog.askopenfilename(
        title="Select QR Code or Barcode",
        filetypes=[
            ("Images", "*.png *.jpg *.jpeg *.bmp *.tif *.tiff"),
            ("All files", "*.*")
        ]
    )

    if not path:
        return

    image = cv2.imread(path)

    if image is None:
        messagebox.showerror("Error", "Unable to open image.")
        return

    codes = decode(image)

    if not codes:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        codes = decode(gray)

    for code in codes:
        raw_data = code.data.decode("utf-8", errors="replace")
        if parse_student_data(raw_data):
            process_student(raw_data)
            return

    messagebox.showerror(
        "No Valid Code",
        "No valid student QR code or barcode was found."
    )


# ==========================================
# WEBCAM SCANNER
# ==========================================

def scan_webcam():
    camera = cv2.VideoCapture(0)

    if not camera.isOpened():
        messagebox.showerror("Camera Error", "Cannot open webcam.")
        return

    last_scanned = None

    try:
        while True:
            ok, frame = camera.read()

            if not ok:
                break

            codes = decode(frame)
            visible_codes = set()

            for code in codes:
                raw_data = code.data.decode("utf-8", errors="replace")
                visible_codes.add(raw_data)

                x, y, w, h = code.rect
                cv2.rectangle(
                    frame, (x, y), (x + w, y + h),
                    (0, 255, 0), 2
                )

                cv2.putText(
                    frame, code.type,
                    (x, max(y - 10, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6, (0, 255, 0), 2
                )

                if (
                    raw_data != last_scanned
                    and parse_student_data(raw_data)
                ):
                    last_scanned = raw_data

                    # Close camera before showing the popup
                    camera.release()
                    cv2.destroyAllWindows()
                    process_student(raw_data)
                    return

            if last_scanned and last_scanned not in visible_codes:
                last_scanned = None

            cv2.imshow("Student Attendance Scanner", frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    finally:
        camera.release()
        cv2.destroyAllWindows()


# ==========================================
# MAIN APPLICATION
# ==========================================

def main():
    root = tk.Tk()
    root.title("School Bus Attendance System")
    root.geometry("430x290")
    root.resizable(False, False)

    tk.Label(
        root,
        text="School Bus Attendance System",
        font=("Arial", 15, "bold")
    ).pack(pady=25)

    tk.Button(
        root,
        text="Import QR / Barcode Image",
        command=import_image,
        width=32,
        height=2
    ).pack(pady=8)

    tk.Button(
        root,
        text="Scan Using Webcam",
        command=scan_webcam,
        width=32,
        height=2
    ).pack(pady=8)

    tk.Label(
        root,
        text="MySQL: school_bus_safety",
        font=("Arial", 9)
    ).pack(pady=12)

    root.mainloop()


if __name__ == "__main__":
    main()
