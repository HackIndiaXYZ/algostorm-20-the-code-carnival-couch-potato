
import cv2
import json
import tkinter as tk
from tkinter import filedialog, messagebox
from pyzbar.pyzbar import decode
from datetime import datetime
import requests

# API configuration
API_URL = "https://your-server.com/api/student-scan"
API_ENABLED = False


def parse_student_data(raw_data):
    try:
        fields = {}

        for item in raw_data.split("|"):
            key, value = item.split(":", 1)
            fields[key.strip().upper()] = value.strip()

        required = [
            "ID", "NAME", "BUS", "STOP", "DROP", "MOBILE"
        ]

        if not all(fields.get(key) for key in required):
            return None

        return {
            "student_id": fields["ID"],
            "student_name": fields["NAME"],
            "bus_no": fields["BUS"],
            "bus_stop": fields["STOP"],
            "bus_drop": fields["DROP"],
            "parent_mobile": fields["MOBILE"]
        }

    except (ValueError, AttributeError):
        return None


def process_student(raw_data):
    student = parse_student_data(raw_data)

    if not student:
        messagebox.showerror(
            "Invalid Code",
            "No valid student record was found.\n"
            "Make sure the code contains a Unique Student ID."
        )
        return

    # Generate timestamp at scan/import time
    student["timestamp"] = datetime.now().astimezone().isoformat(
        timespec="seconds"
    )

    print("\nStudent scan payload:")
    print(json.dumps(student, indent=4))

    api_status = "API disabled"

    if API_ENABLED:
        try:
            response = requests.post(
                API_URL,
                json=student,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            response.raise_for_status()
            api_status = "API request successful"
            print("API response:", response.text)

        except requests.RequestException as error:
            api_status = "API request failed"
            print(api_status + ":", error)

    details = (
        f"Unique Student ID: {student['student_id']}\n"
        f"Student Name: {student['student_name']}\n"
        f"Bus No: {student['bus_no']}\n"
        f"Bus Stop: {student['bus_stop']}\n"
        f"Bus Drop: {student['bus_drop']}\n"
        f"Parent Mobile: {student['parent_mobile']}\n"
        f"Timestamp: {student['timestamp']}\n\n"
        f"Status: {api_status}"
    )

    messagebox.showinfo("Student Bus Details", details)


def decode_image(image):
    # Try the original image first
    codes = decode(image)

    if not codes:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        codes = decode(gray)

    return codes


def import_image():
    path = filedialog.askopenfilename(
        title="Import QR Code or Barcode",
        filetypes=[
            ("Image files", "*.png *.jpg *.jpeg *.bmp *.tif *.tiff"),
            ("All files", "*.*")
        ]
    )

    if not path:
        return

    image = cv2.imread(path)

    if image is None:
        messagebox.showerror(
            "Image Error",
            "Unable to open this image."
        )
        return

    codes = decode_image(image)

    if not codes:
        messagebox.showerror(
            "No Code Found",
            "Could not read a QR code or barcode from this image."
        )
        return

    for code in codes:
        raw_data = code.data.decode("utf-8", errors="replace")
        student = parse_student_data(raw_data)

        if student:
            process_student(raw_data)
            return

    messagebox.showerror(
        "Invalid Code",
        "No valid student code containing a unique ID was found."
    )


def scan_webcam():
    camera = cv2.VideoCapture(0)

    if not camera.isOpened():
        messagebox.showerror(
            "Camera Error",
            "Unable to open webcam."
        )
        return

    print("Scanner started. Press Q to exit.")
    last_scanned = None

    try:
        while True:
            success, frame = camera.read()

            if not success:
                break

            codes = decode(frame)
            visible_data = set()

            for code in codes:
                raw_data = code.data.decode(
                    "utf-8", errors="replace"
                )
                visible_data.add(raw_data)

                x, y, w, h = code.rect
                cv2.rectangle(
                    frame, (x, y), (x + w, y + h),
                    (0, 255, 0), 2
                )

                cv2.putText(
                    frame,
                    code.type,
                    (x, max(y - 10, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6, (0, 255, 0), 2
                )

                # Process a barcode only once while it stays visible
                if raw_data != last_scanned:
                    if parse_student_data(raw_data):
                        last_scanned = raw_data

                        # Close camera before showing popup
                        camera.release()
                        cv2.destroyAllWindows()
                        process_student(raw_data)
                        return

            # Allow scanning the same code again after it disappears
            if last_scanned and last_scanned not in visible_data:
                last_scanned = None

            cv2.imshow("Student QR / Barcode Scanner", frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    finally:
        camera.release()
        cv2.destroyAllWindows()


def main():
    root = tk.Tk()
    root.title("Student Bus Code Reader")
    root.geometry("420x280")
    root.resizable(False, False)

    tk.Label(
        root,
        text="Student Bus Code Reader",
        font=("Arial", 16, "bold")
    ).pack(pady=25)

    tk.Button(
        root,
        text="Import QR / Barcode Image",
        command=import_image,
        width=30,
        height=2
    ).pack(pady=8)

    tk.Button(
        root,
        text="Scan Using Webcam",
        command=scan_webcam,
        width=30,
        height=2
    ).pack(pady=8)

    tk.Label(
        root,
        text="Supports QR codes and Code 128 barcodes"
    ).pack(pady=10)

    root.mainloop()


if __name__ == "__main__":
    main()
