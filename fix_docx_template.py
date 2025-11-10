#!/usr/bin/env python3
"""
Narzędzie do diagnostyki i naprawy tagów Jinja2 w plikach DOCX.

Word często rozbija tagi {{ variable }} na wiele węzłów XML, co powoduje
błędy parsowania w docxtpl. Ten skrypt naprawia te problemy.

Użycie:
    python3 fix_docx_template.py templates/oferta-podstawowa/oferta1.docx
"""

import sys
import re
from pathlib import Path
from zipfile import ZipFile
import zipfile
import tempfile
import shutil
import xml.etree.ElementTree as ET


def analyze_jinja_tags(xml_content: str, file_name: str) -> None:
    """Analizuje i wyświetla znalezione tagi Jinja w XML"""
    print(f"\n{'='*60}")
    print(f"Analyzing: {file_name}")
    print(f"{'='*60}")

    # Znajdź wszystkie potencjalne tagi Jinja
    var_tags = re.findall(r'\{\{[^}]*\}\}', xml_content, re.DOTALL)
    block_tags = re.findall(r'\{%[^%]*%\}', xml_content, re.DOTALL)

    print(f"\nFound {len(var_tags)} variable tags {{{{ }}}}")
    for i, tag in enumerate(var_tags[:10], 1):  # Pokaż pierwsze 10
        # Pokaż czy tag ma zagnieżdżone tagi XML
        has_xml = bool(re.search(r'<[^>]+>', tag))
        status = "❌ BROKEN (contains XML)" if has_xml else "✅ OK"
        print(f"  {i}. {status}")
        print(f"     {tag[:100]}")

    print(f"\nFound {len(block_tags)} block tags {{% %}}")
    for i, tag in enumerate(block_tags[:10], 1):
        has_xml = bool(re.search(r'<[^>]+>', tag))
        status = "❌ BROKEN (contains XML)" if has_xml else "✅ OK"
        print(f"  {i}. {status}")
        print(f"     {tag[:100]}")


def aggressive_fix_xml(xml_content: str) -> str:
    """
    Agresywnie naprawia rozbite tagi Jinja2 w XML.

    Strategia:
    1. Znajdź wszystkie paragrafy <w:p>
    2. W każdym paragrafie znajdź tagi Jinja
    3. Jeśli tag jest rozbity, uprość XML w tym miejscu
    """

    # Namespace dla Word XML
    namespaces = {
        'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    }

    try:
        # Parsuj XML
        root = ET.fromstring(xml_content)

        # Znajdź wszystkie paragrafy
        for para in root.findall('.//w:p', namespaces):
            # Wyekstrahuj cały tekst z paragrafu
            full_text = ''.join(para.itertext())

            # Czy ten paragraf zawiera tagi Jinja?
            if '{{' in full_text or '{%' in full_text:
                # Uprość XML tego paragrafu - usuń wszystkie <w:r> i zostaw tylko tekst
                simplify_paragraph(para, full_text, namespaces)

        # Serializuj z powrotem do XML
        ET.register_namespace('w', namespaces['w'])
        ET.register_namespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')

        return ET.tostring(root, encoding='unicode', method='xml')

    except ET.ParseError:
        # Jeśli XML jest zbyt uszkodzony, użyj regex fallback
        return regex_fix_xml(xml_content)


def simplify_paragraph(para, text_content, namespaces):
    """Upraszcza paragraf zawierający tagi Jinja"""
    # Usuń wszystkie dzieci paragrafu
    for child in list(para):
        para.remove(child)

    # Utwórz pojedynczy run z tekstem
    run = ET.SubElement(para, f"{{{namespaces['w']}}}r")
    text_elem = ET.SubElement(run, f"{{{namespaces['w']}}}t")
    text_elem.text = text_content

    # Zachowaj białe znaki
    text_elem.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')


def regex_fix_xml(xml_content: str) -> str:
    """Fallback: napraw XML używając regex (mniej precyzyjne, ale działa na uszkodzonym XML)"""

    print("\nUsing regex-based fix (XML too broken for parser)...")

    # Strategia: znajdź tagi Jinja i wyczyść wszystko pomiędzy nimi

    def fix_jinja_var(match):
        """Napraw tag {{ }}"""
        full_match = match.group(0)
        # Wyekstrahuj tekst bez tagów XML
        text_only = re.sub(r'<[^>]+>', '', full_match)
        # Zwróć w prostym formacie
        return f'<w:r><w:t xml:space="preserve">{text_only}</w:t></w:r>'

    def fix_jinja_block(match):
        """Napraw tag {% %}"""
        full_match = match.group(0)
        text_only = re.sub(r'<[^>]+>', '', full_match)
        return f'<w:r><w:t xml:space="preserve">{text_only}</w:t></w:r>'

    # Napraw tagi {{ }} - dopasuj bardzo liberalnie
    xml_content = re.sub(
        r'<w:r[^>]*>.*?\{\{.*?\}\}.*?</w:r>',
        fix_jinja_var,
        xml_content,
        flags=re.DOTALL
    )

    # Napraw tagi {% %}
    xml_content = re.sub(
        r'<w:r[^>]*>.*?\{%.*?%\}.*?</w:r>',
        fix_jinja_block,
        xml_content,
        flags=re.DOTALL
    )

    # Usuń wszystkie puste runy
    xml_content = re.sub(r'<w:r[^>]*>\s*</w:r>', '', xml_content)

    return xml_content


def fix_docx_file(input_path: Path, output_path: Path = None, analyze_only: bool = False) -> Path:
    """
    Naprawia tagi Jinja2 w pliku DOCX.

    Args:
        input_path: Ścieżka do oryginalnego DOCX
        output_path: Ścieżka do naprawionego DOCX (domyślnie: input_path z suffixem _fixed)
        analyze_only: Jeśli True, tylko analizuje bez naprawy

    Returns:
        Ścieżka do naprawionego pliku
    """

    if output_path is None:
        output_path = input_path.parent / f"{input_path.stem}_fixed.docx"

    print(f"\n{'='*60}")
    print(f"Processing: {input_path}")
    print(f"Output: {output_path}")
    print(f"{'='*60}")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # Rozpakuj DOCX
        print("\n1. Extracting DOCX...")
        with ZipFile(input_path, 'r') as zip_ref:
            zip_ref.extractall(tmpdir_path)

        # Przetwórz document.xml
        document_xml = tmpdir_path / "word" / "document.xml"
        if document_xml.exists():
            print("\n2. Processing word/document.xml...")
            with open(document_xml, 'r', encoding='utf-8') as f:
                content = f.read()

            # Analiza
            analyze_jinja_tags(content, "word/document.xml")

            if not analyze_only:
                # Napraw
                print("\n3. Fixing broken Jinja tags...")
                fixed_content = aggressive_fix_xml(content)

                # Zapisz
                with open(document_xml, 'w', encoding='utf-8') as f:
                    f.write(fixed_content)

                print("   ✅ Fixed word/document.xml")

        # Przetwórz inne pliki XML (header, footer, etc.)
        word_dir = tmpdir_path / "word"
        xml_files = [f for f in word_dir.glob("*.xml") if f.name != "document.xml"]

        if xml_files and not analyze_only:
            print(f"\n4. Processing {len(xml_files)} other XML files...")
            for xml_file in xml_files:
                try:
                    with open(xml_file, 'r', encoding='utf-8') as f:
                        content = f.read()

                    if '{{' in content or '{%' in content:
                        fixed_content = aggressive_fix_xml(content)
                        with open(xml_file, 'w', encoding='utf-8') as f:
                            f.write(fixed_content)
                        print(f"   ✅ Fixed {xml_file.name}")
                except Exception as e:
                    print(f"   ⚠️  Skipped {xml_file.name}: {e}")

        if analyze_only:
            print("\n✅ Analysis complete (no changes made)")
            return input_path

        # Zapakuj z powrotem
        print("\n5. Packing fixed DOCX...")
        with ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
            for file_path in tmpdir_path.rglob('*'):
                if file_path.is_file():
                    arcname = file_path.relative_to(tmpdir_path)
                    zip_ref.write(file_path, arcname)

        print(f"\n✅ SUCCESS! Fixed file saved to:")
        print(f"   {output_path}")

    return output_path


def main():
    """Main CLI interface"""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  Analyze: python3 fix_docx_template.py <docx_file> --analyze")
        print("  Fix:     python3 fix_docx_template.py <docx_file>")
        print("")
        print("Examples:")
        print("  python3 fix_docx_template.py templates/oferta-podstawowa/oferta1.docx")
        print("  python3 fix_docx_template.py templates/wolftax-oferta/Dok1.docx --analyze")
        sys.exit(1)

    input_file = Path(sys.argv[1])
    analyze_only = "--analyze" in sys.argv

    if not input_file.exists():
        print(f"❌ Error: File not found: {input_file}")
        sys.exit(1)

    if not input_file.suffix.lower() == '.docx':
        print(f"❌ Error: Not a DOCX file: {input_file}")
        sys.exit(1)

    try:
        output_file = fix_docx_file(input_file, analyze_only=analyze_only)

        if not analyze_only:
            print("\n" + "="*60)
            print("Next steps:")
            print("="*60)
            print(f"1. Test the fixed file: {output_file}")
            print(f"2. If it works, replace the original:")
            print(f"   cp {output_file} {input_file}")
            print(f"3. Try rendering again with offer_api.py")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
