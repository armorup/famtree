#!/usr/bin/env python3
"""
Generate face-centered thumbnails from portraits and doodles.
Uses face detection to center on the face, falls back to center crop.
"""

import os
from pathlib import Path
from PIL import Image

# Try to import face_recognition, fall back to center crop if not available
try:
    import face_recognition
    HAS_FACE_RECOGNITION = True
    print("Using face_recognition for smart cropping")
except ImportError:
    HAS_FACE_RECOGNITION = False
    print("face_recognition not available, using center crop")

THUMB_SIZE = 100
OUTPUT_FORMAT = 'PNG'  # WebP has better compression but PNG is more compatible

def get_face_center(image_path):
    """Detect face and return center coordinates, or None if no face found."""
    if not HAS_FACE_RECOGNITION:
        return None

    try:
        image = face_recognition.load_image_file(image_path)
        face_locations = face_recognition.face_locations(image)

        if face_locations:
            # Use first face found (top, right, bottom, left)
            top, right, bottom, left = face_locations[0]
            center_x = (left + right) // 2
            center_y = (top + bottom) // 2
            face_height = bottom - top
            return center_x, center_y, face_height
    except Exception as e:
        print(f"  Face detection error: {e}")

    return None

def create_thumbnail(input_path, output_path, size=THUMB_SIZE):
    """Create a face-centered square thumbnail."""

    with Image.open(input_path) as img:
        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        width, height = img.size

        # Try face detection
        face_info = get_face_center(input_path)

        if face_info:
            center_x, center_y, face_height = face_info
            # Make crop size based on face size (face should be ~60% of thumbnail)
            crop_size = int(face_height * 1.8)
            crop_size = max(crop_size, min(width, height) // 2)
            crop_size = min(crop_size, min(width, height))
            print(f"  Face detected, centering on face")
        else:
            # Fall back to center crop
            center_x = width // 2
            center_y = height // 3  # Bias toward top third for head shots
            crop_size = min(width, height)
            print(f"  No face detected, using top-center crop")

        # Calculate crop box
        half = crop_size // 2
        left = max(0, center_x - half)
        top = max(0, center_y - half)
        right = min(width, left + crop_size)
        bottom = min(height, top + crop_size)

        # Adjust if we hit edges
        if right - left < crop_size:
            left = max(0, right - crop_size)
        if bottom - top < crop_size:
            top = max(0, bottom - crop_size)

        # Crop and resize
        cropped = img.crop((left, top, right, bottom))
        thumbnail = cropped.resize((size, size), Image.LANCZOS)

        # Save
        thumbnail.save(output_path, OUTPUT_FORMAT, quality=90)

        return True

def process_directory(input_dir, output_dir):
    """Process all images in a directory."""
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Get all image files
    extensions = {'.png', '.jpg', '.jpeg', '.webp'}
    images = [f for f in input_path.iterdir()
              if f.suffix.lower() in extensions]

    print(f"\nProcessing {len(images)} images from {input_dir}")

    for img_file in sorted(images):
        output_file = output_path / f"{img_file.stem}.png"
        print(f"  {img_file.name} -> {output_file.name}")

        try:
            create_thumbnail(str(img_file), str(output_file))
        except Exception as e:
            print(f"    ERROR: {e}")

def main():
    base_dir = Path(__file__).parent

    # Process photos
    process_directory(
        base_dir / "photos",
        base_dir / "thumbs" / "photos"
    )

    # Process doodles
    process_directory(
        base_dir / "doodles",
        base_dir / "thumbs" / "doodles"
    )

    print("\nDone! Thumbnails saved to thumbs/")

if __name__ == "__main__":
    main()
