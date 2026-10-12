
import tkinter as tk
from tkinter import filedialog, messagebox
import barcode
from barcode.writer import ImageWriter
from io import BytesIO
from PIL import Image


class StudentBarcodeGenerator:
    def __init__(self, master):
        self.master = master
        master.title("Student Bus Barcode Generator")
        master.geometry("450x490")
        master.resizable(False, False)

        self.entries = {}

        fields = [
            ("Unique Student ID", "student_id"),
            ("Student Name", "name"),
            ("Bus No", "bus"),
            ("Bus Stop", "stop"),
            ("Bus Drop", "drop"),
            ("Parent Mobile No", "mobile")
        ]

        for label, key in fields:
            tk.Label(master, text=label + ":").pack(pady=(8, 0))
            entry = tk.Entry(master, width=42)
            entry.pack()
            self.entries[key] = entry

        tk.Button(
            master,
            text="Generate Barcode",
            command=self.generate
        ).pack(pady=15)

        self.save_button = tk.Button(
            master,
            text="Save Barcode",
            command=self.save,
            state=tk.DISABLED
        )
        self.save_button.pack()

        self.image = None

    def generate(self):
        values = {
            key: entry.get().strip()
            for key, entry in self.entries.items()
        }

        if not all(values.values()):
            messagebox.showwarning(
                "Missing Information",
                "Please fill in all six fields."
            )
            return

        # Keep the unique ID alphanumeric without separators.
        if not all(
            c.isalnum() or c in "-_"
            for c in values["student_id"]
        ):
            messagebox.showwarning(
                "Invalid Student ID",
                "Use only letters, numbers, hyphens or underscores."
            )
            return

        if "|" in "".join(values.values()):
            messagebox.showwarning(
                "Invalid Character",
                "The | character is not allowed in student details."
            )
            return

        if not values["mobile"].isdigit() or len(values["mobile"]) != 10:
            messagebox.showwarning(
                "Invalid Mobile",
                "Enter a 10-digit parent mobile number."
            )
            return

        data = (
            f"ID:{values['student_id']}|"
            f"NAME:{values['name']}|"
            f"BUS:{values['bus']}|"
            f"STOP:{values['stop']}|"
            f"DROP:{values['drop']}|"
            f"MOBILE:{values['mobile']}"
        )

        try:
            barcode_class = barcode.get_barcode_class("code128")
            code = barcode_class(data, writer=ImageWriter())

            buffer = BytesIO()
            code.write(buffer, options={
                "module_width": 0.25,
                "module_height": 25,
                "quiet_zone": 4,
                "write_text": False
            })

            buffer.seek(0)
            self.image = Image.open(buffer).copy()

            self.save_button.config(state=tk.NORMAL)

            messagebox.showinfo(
                "Success",
                f"Barcode generated for student ID: "
                f"{values['student_id']}"
            )

        except Exception as error:
            messagebox.showerror("Error", str(error))

    def save(self):
        if self.image is None:
            return

        path = filedialog.asksaveasfilename(
            title="Save Student Barcode",
            initialfile="student_barcode.png",
            defaultextension=".png",
            filetypes=[("PNG Image", "*.png")]
        )

        if path:
            self.image.save(path)
            messagebox.showinfo(
                "Saved",
                f"Barcode saved successfully:\n{path}"
            )


if __name__ == "__main__":
    root = tk.Tk()
    app = StudentBarcodeGenerator(root)
    root.mainloop()
