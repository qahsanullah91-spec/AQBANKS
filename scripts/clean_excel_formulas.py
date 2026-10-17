"""
Clean Excel formulas and generate AQ_Companies_System_v10_Logistics_Cleaned.xlsx
"""
import sys
import subprocess

def main():
    print("Executing Node.js Excel cleaning engine...")
    subprocess.run(["node", "scripts/clean_excel_formulas.js"], check=True)

if __name__ == "__main__":
    main()
