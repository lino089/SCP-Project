import sys
import os
import json

def extract_pdf_text(file_path):
    if not os.path.exists(file_path):
        return {"success": False, "error": f"File not found: {file_path}"}
    
    try:
        import pdfplumber
        full_text = []
        with pdfplumber.open(file_path) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    full_text.append(page_text.strip())
        
        extracted = "\n\n".join(full_text)
        return {"success": True, "text": extracted}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    result = extract_pdf_text(pdf_path)
    print(json.dumps(result))
    if not result.get("success"):
        sys.exit(1)
