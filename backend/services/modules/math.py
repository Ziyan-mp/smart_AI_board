import base64
from io import BytesIO
from typing import Dict, Any
import logging
import re

from PIL import Image, ImageOps, ImageEnhance
import sympy
from sympy import sympify, solve, Eq


logger = logging.getLogger(__name__)


def normalize_math(equation: str) -> str:
    # Remove harmless LaTeX spacing
    eq = equation.replace(r"\,", "")
    eq = eq.replace(r"\;", "")
    eq = eq.replace(r"\:", "")
    eq = eq.replace(r"\!", "")

    # Remove extra spaces
    eq = eq.replace(" ", "")

    # Replace multiplication symbols
    eq = eq.replace("×", "*").replace("·", "*")

    # Replace superscripts
    eq = eq.replace("²", "**2").replace("³", "**3")

    # Replace √x with sqrt(x)
    eq = re.sub(r"√([a-zA-Z0-9]+)", r"sqrt(\1)", eq)

    # Insert * between digits and letters/parenthesis
    eq = re.sub(r"(\d)([a-zA-Z\(])", r"\1*\2", eq)

    # Insert * between letter and parenthesis
    eq = re.sub(r"([a-zA-Z])(\()", r"\1*\2", eq)

    # Insert * between parenthesis and letter/parenthesis
    eq = re.sub(r"(\))([a-zA-Z\(])", r"\1*\2", eq)

    return eq


def solve_math(eq_norm: str) -> str:
    try:
        if "=" in eq_norm:
            left, right = eq_norm.split("=", 1)

            lhs = sympify(left)
            rhs = sympify(right)

            symbols = list(lhs.free_symbols | rhs.free_symbols)

            if not symbols:
                return str(lhs == rhs)

            symbols.sort(key=lambda s: s.name)

            solution = solve(Eq(lhs, rhs), symbols[0])

            if isinstance(solution, list):
                if len(solution) == 0:
                    return "No solution"

                sol_strs = [str(s) for s in solution]
                return f"{symbols[0]} = {', '.join(sol_strs)}"

            elif isinstance(solution, dict):
                return ", ".join(
                    [f"{k} = {v}" for k, v in solution.items()]
                )

            else:
                return f"{symbols[0]} = {str(solution)}"

        else:
            expr = sympify(eq_norm)
            res = sympy.simplify(expr)
            return str(res)

    except Exception as e:
        logger.error(f"[AI] SymPy solving error: {e}")
        return "Could not solve the recognized expression."


def process_math(image_b64: str) -> Dict[str, Any]:

    print("[AI] process_math() started", flush=True)

    if not image_b64:
        print("[AI] Image received: NO", flush=True)
        raise ValueError("No image data provided for math recognition.")

    print("[AI] Image received: YES", flush=True)

    # -------------------------------------------------
    # Decode and preprocess image
    # -------------------------------------------------
    try:
        print("[AI] Starting image decode...", flush=True)

        if "," in image_b64:
            image_b64 = image_b64.split(",", 1)[1]

        img_data = base64.b64decode(image_b64)

        print(
            f"[AI] Image decoded: {len(img_data)} bytes",
            flush=True,
        )

        img = Image.open(BytesIO(img_data)).convert("RGB")

        print(
            f"[AI] Original image size: {img.size}",
            flush=True,
        )

        # Grayscale
        img_gray = ImageOps.grayscale(img)

        # Contrast
        enhancer = ImageEnhance.Contrast(img_gray)
        img_contrast = enhancer.enhance(2.0)

        # Find handwriting/content bounding box
        inverted = ImageOps.invert(img_contrast)
        bbox = inverted.getbbox()

        if bbox:
            img_cropped = img_contrast.crop(bbox)
            print(
                f"[AI] Cropped image size: {img_cropped.size}",
                flush=True,
            )
        else:
            img_cropped = img_contrast
            print(
                "[AI] No bounding box found; using original image",
                flush=True,
            )

        # Padding
        padding = 40
        img_padded = ImageOps.expand(
            img_cropped,
            border=padding,
            fill="white",
        )

        # Limit image dimensions to reduce memory usage
        max_dimension = 1600

        w, h = img_padded.size

        scale = min(
            max_dimension / w,
            max_dimension / h,
            1.5,
        )

        if scale < 1:
            new_size = (
                max(1, int(w * scale)),
                max(1, int(h * scale)),
            )

            img_final = img_padded.resize(
                new_size,
                Image.Resampling.LANCZOS,
            )

        elif scale > 1:
            new_size = (
                int(w * scale),
                int(h * scale),
            )

            img_final = img_padded.resize(
                new_size,
                Image.Resampling.LANCZOS,
            )

        else:
            img_final = img_padded

        print(
            f"[AI] Final image size: {img_final.size}",
            flush=True,
        )

    except Exception as e:
        logger.exception(
            f"[AI] Failed to decode or preprocess image: {e}"
        )

        raise ValueError(
            "Invalid image data format."
        )

    # -------------------------------------------------
    # Load Pix2Text
    # -------------------------------------------------
    try:
        print(
            "[AI] Importing Pix2Text...",
            flush=True,
        )

        from pix2text import Pix2Text

        print(
            "[AI] Pix2Text imported successfully",
            flush=True,
        )

    except Exception as e:
        logger.exception(
            f"[AI] Pix2Text import failed: {e}"
        )

        raise RuntimeError(
            "Pix2Text is unavailable."
        )

    # -------------------------------------------------
    # Pix2Text recognition
    # -------------------------------------------------
    try:
        print(
            "[AI] Calling Pix2Text.from_config()...",
            flush=True,
        )

        p2t = Pix2Text.from_config()

        print(
            "[AI] Pix2Text initialized successfully",
            flush=True,
        )

        print(
            "[AI] Calling recognize_formula()...",
            flush=True,
        )

        res = p2t.recognize_formula(
            img_final,
            return_text=False,
        )

        print(
            f"[AI] Pix2Text returned: {res}",
            flush=True,
        )

        if isinstance(res, dict):
            equation = res.get("text", "")
            score = res.get("score", None)

        elif isinstance(res, str):
            equation = res
            score = None

        else:
            equation = str(res)
            score = None

        print(
            f"[AI] Pix2Text raw result: {equation}",
            flush=True,
        )

    except Exception as e:
        logger.exception(
            f"[AI] Pix2Text processing error: {e}"
        )

        raise RuntimeError(
            f"Pix2Text processing failed: {str(e)}"
        )

    # -------------------------------------------------
    # SymPy
    # -------------------------------------------------
    try:
        print(
            "[AI] Solving math with SymPy...",
            flush=True,
        )

        eq_norm = normalize_math(equation)

        print(
            f"[AI] Normalized math: {eq_norm}",
            flush=True,
        )

        solution_str = solve_math(eq_norm)

        print(
            f"[AI] SymPy solution: {solution_str}",
            flush=True,
        )

    except Exception as e:
        logger.exception(
            f"[AI] SymPy processing error: {e}"
        )

        solution_str = (
            "Could not solve the recognized expression."
        )

    # -------------------------------------------------
    # Return result
    # -------------------------------------------------
    print(
        "[AI] Returning Math Result",
        flush=True,
    )

    return {
        "module": "math",
        "result_type": "solution",
        "recognized_content": equation,
        "explanation": (
            "Math recognized using local Pix2Text model."
        ),
        "confidence": score,
        "data": {
            "solution": solution_str
        },
    }