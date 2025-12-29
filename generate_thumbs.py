#!/usr/bin/env python3
"""
Generate face-centered thumbnails from portraits and doodles.
Uses OpenCV DNN face detection to center on the face with tight cropping.
"""

import os
from pathlib import Path
from PIL import Image
import numpy as np

# Try to import OpenCV for face detection
try:
    import cv2
    HAS_OPENCV = True
    print("Using OpenCV for face detection")
except ImportError:
    HAS_OPENCV = False
    print("OpenCV not available, using center crop")
    print("Install with: pip install opencv-python-headless")

THUMB_SIZE = 100
OUTPUT_FORMAT = 'PNG'

# OpenCV's pre-trained face detector (Haar cascade)
FACE_CASCADE = None
if HAS_OPENCV:
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    FACE_CASCADE = cv2.CascadeClassifier(cascade_path)

def get_face_bounds(image_path):
    """Detect face and return bounding box, or None if no face found."""
    if not HAS_OPENCV or FACE_CASCADE is None:
        return None

    try:
        # Load image
        img = cv2.imread(str(image_path))
        if img is None:
            return None

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape[:2]

        # Detect faces with different scale factors for better detection
        faces = FACE_CASCADE.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )

        # If no faces found, try with more lenient parameters
        if len(faces) == 0:
            faces = FACE_CASCADE.detectMultiScale(
                gray,
                scaleFactor=1.05,
                minNeighbors=3,
                minSize=(20, 20)
            )

        if len(faces) > 0:
            # Use largest face found
            x, y, face_w, face_h = max(faces, key=lambda f: f[2] * f[3])

            # Calculate face center
            center_x = x + face_w // 2
            center_y = y + face_h // 2

            return {
                'center_x': center_x,
                'center_y': center_y,
                'face_width': face_w,
                'face_height': face_h,
                'image_width': w,
                'image_height': h
            }
    except Exception as e:
        print(f"  Face detection error: {e}")

    return None

def create_thumbnail(input_path, output_path, size=THUMB_SIZE):
    """Create a face-centered square thumbnail with tight cropping."""

    with Image.open(input_path) as img:
        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        width, height = img.size

        # Try face detection
        face_info = get_face_bounds(input_path)

        if face_info:
            center_x = face_info['center_x']
            center_y = face_info['center_y']
            face_h = face_info['face_height']

            # Tight crop: face should fill ~65% of thumbnail vertically
            # So crop_size = face_height / 0.65
            crop_size = int(face_h / 0.65)

            # Ensure crop size doesn't exceed image dimensions
            crop_size = min(crop_size, min(width, height))

            # Adjust center_y slightly up to account for forehead/hair
            # (face detection often starts at eyebrows, not hairline)
            center_y = center_y - int(face_h * 0.05)

            print(f"  Face detected: {face_h}px tall, crop: {crop_size}px")
        else:
            # Fall back to center crop
            center_x = width // 2
            center_y = height // 3  # Bias toward top third for head shots
            crop_size = min(width, height)
            print(f"  No face detected, using center crop")

        # Calculate crop box
        half = crop_size // 2
        left = center_x - half
        top = center_y - half
        right = left + crop_size
        bottom = top + crop_size

        # Adjust if we hit edges
        if left < 0:
            left = 0
            right = crop_size
        if top < 0:
            top = 0
            bottom = crop_size
        if right > width:
            right = width
            left = width - crop_size
        if bottom > height:
            bottom = height
            top = height - crop_size

        # Final safety check
        left = max(0, left)
        top = max(0, top)
        right = min(width, right)
        bottom = min(height, bottom)

        # Crop and resize
        cropped = img.crop((left, top, right, bottom))
        thumbnail = cropped.resize((size, size), Image.LANCZOS)

        # Save
        thumbnail.save(output_path, OUTPUT_FORMAT, quality=90)

        return True

def simple_resize(input_path, output_path, size=THUMB_SIZE):
    """Simple center crop and resize without face detection."""
    with Image.open(input_path) as img:
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        width, height = img.size

        # Center crop to square
        min_dim = min(width, height)
        left = (width - min_dim) // 2
        top = (height - min_dim) // 2

        cropped = img.crop((left, top, left + min_dim, top + min_dim))
        thumbnail = cropped.resize((size, size), Image.LANCZOS)
        thumbnail.save(output_path, OUTPUT_FORMAT, quality=90)

def process_directory(input_dir, output_dir, use_face_detection=True):
    """Process all images in a directory."""
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Get all image files
    extensions = {'.png', '.jpg', '.jpeg', '.webp'}
    images = [f for f in input_path.iterdir()
              if f.suffix.lower() in extensions]

    mode = "face detection" if use_face_detection else "simple resize"
    print(f"\nProcessing {len(images)} images from {input_dir} ({mode})")

    for img_file in sorted(images):
        output_file = output_path / f"{img_file.stem}.png"
        print(f"  {img_file.name} -> {output_file.name}")

        try:
            if use_face_detection:
                create_thumbnail(str(img_file), str(output_file))
            else:
                simple_resize(str(img_file), str(output_file))
                print(f"  Resized to {THUMB_SIZE}x{THUMB_SIZE}")
        except Exception as e:
            print(f"    ERROR: {e}")

def main():
    base_dir = Path(__file__).parent

    # Process photos with face detection
    process_directory(
        base_dir / "photos",
        base_dir / "thumbs" / "photos",
        use_face_detection=True
    )

    # Process doodles with simple resize (no face detection)
    process_directory(
        base_dir / "doodles",
        base_dir / "thumbs" / "doodles",
        use_face_detection=False
    )

    print("\nDone! Thumbnails saved to thumbs/")

if __name__ == "__main__":
    main()
