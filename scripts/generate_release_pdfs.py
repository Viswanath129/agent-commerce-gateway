import os
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#334155"))
        
        # Running Header (pages > 1)
        if self._pageNumber > 1:
            doc_title = getattr(self, "doc_title", "AGENT COMMERCE GATEWAY (ACG / MACCP)")
            self.drawString(54, 11 * inch - 36, doc_title.upper())
            self.setFont("Helvetica", 7.5)
            self.drawRightString(8.5 * inch - 54, 11 * inch - 36, "Merchant Control Plane | Razorpay AI Track 01")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.75)
            self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)
        
        # Running Footer
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(54, 32, "VERIFIED RELEASE CANDIDATE — 1.0.0-RC | SEPTEMBER 2026")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 54, 32, page_text)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.75)
        self.line(54, 42, 8.5 * inch - 54, 42)
        
        self.restoreState()

def create_styles():
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=6,
    )
    
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#B45309"),
        spaceAfter=14,
    )
    
    h1_style = ParagraphStyle(
        "DocH1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True,
    )
    
    h2_style = ParagraphStyle(
        "DocH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor("#1E293B"),
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )
    
    body_style = ParagraphStyle(
        "DocBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#334155"),
        spaceAfter=5,
    )
    
    code_style = ParagraphStyle(
        "DocCode",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )
    
    callout_style = ParagraphStyle(
        "DocCallout",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1E293B"),
    )
    
    th_style = ParagraphStyle(
        "DocTH",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
    )
    
    td_style = ParagraphStyle(
        "DocTD",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1E293B"),
    )
    
    return {
        "title": title_style,
        "subtitle": subtitle_style,
        "h1": h1_style,
        "h2": h2_style,
        "body": body_style,
        "code": code_style,
        "callout": callout_style,
        "th": th_style,
        "td": td_style,
    }

def clean_inline_md(text):
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\*(.*?)\*", r"<i>\1</i>", text)
    text = re.sub(r"`(.*?)`", r"<font face='Courier' color='#0F172A'>\1</font>", text)
    text = text.replace("₹", "INR ")
    text = text.replace("→", "-&gt;")
    text = text.replace("──►", "==&gt;")
    text = text.replace("───►", "===&gt;")
    text = text.replace("─►", "=&gt;")
    text = text.replace("│", "|")
    text = text.replace("┌", "+").replace("┐", "+").replace("└", "+").replace("┘", "+")
    text = text.replace("├", "+").replace("┤", "+").replace("┬", "+").replace("┴", "+")
    text = text.replace("•", "&bull;")
    text = text.replace("$\\ge", "&gt;=").replace("$\\le", "&lt;=")
    text = text.replace("$", "")
    return text

def parse_markdown_to_flowables(md_content, styles, is_cover=False):
    flowables = []
    lines = md_content.split("\n")
    i = 0
    in_code_block = False
    code_lines = []
    in_table = False
    table_rows = []

    while i < len(lines):
        line = lines[i]

        if line.strip().startswith("```"):
            if in_code_block:
                code_text = "<br/>".join([clean_inline_md(l) for l in code_lines])
                code_p = Paragraph(code_text, styles["code"])
                t = Table([[code_p]], colWidths=[504])
                t.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
                    ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]))
                flowables.append(t)
                flowables.append(Spacer(1, 6))
                in_code_block = False
                code_lines = []
            else:
                in_code_block = True
                code_lines = []
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        # Handle Tables
        if "|" in line and ("---" in line or (i + 1 < len(lines) and "---" in lines[i + 1]) or in_table):
            in_table = True
            if "---" in line:
                i += 1
                continue
            cells = [c.strip() for c in line.split("|")]
            if cells and cells[0] == "":
                cells = cells[1:]
            if cells and cells[-1] == "":
                cells = cells[:-1]
            if cells:
                table_rows.append(cells)
            
            # Check if table ends
            if i + 1 >= len(lines) or "|" not in lines[i + 1]:
                # Render table
                if table_rows:
                    num_cols = max(len(r) for r in table_rows)
                    col_width = 504 / num_cols
                    col_widths = [col_width] * num_cols
                    
                    data = []
                    for row_idx, row in enumerate(table_rows):
                        row_data = []
                        is_header = (row_idx == 0)
                        style_to_use = styles["th"] if is_header else styles["td"]
                        for cell in row:
                            row_data.append(Paragraph(clean_inline_md(cell), style_to_use))
                        while len(row_data) < num_cols:
                            row_data.append(Paragraph("", style_to_use))
                        data.append(row_data)
                    
                    table_flowable = Table(data, colWidths=col_widths)
                    table_flowable.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ]))
                    flowables.append(table_flowable)
                    flowables.append(Spacer(1, 6))
                in_table = False
                table_rows = []
            i += 1
            continue

        stripped = line.strip()
        if not stripped:
            i += 1
            continue

        if stripped.startswith("# "):
            title_text = clean_inline_md(stripped[2:])
            flowables.append(Paragraph(title_text, styles["title"]))
            flowables.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#B45309"), spaceBefore=2, spaceAfter=8))
        elif stripped.startswith("## "):
            flowables.append(Paragraph(clean_inline_md(stripped[3:]), styles["h1"]))
        elif stripped.startswith("### "):
            flowables.append(Paragraph(clean_inline_md(stripped[4:]), styles["h2"]))
        elif stripped.startswith("> "):
            callout_text = clean_inline_md(stripped[2:])
            callout_p = Paragraph(callout_text, styles["callout"])
            t = Table([[callout_p]], colWidths=[504])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#D97706")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]))
            flowables.append(t)
            flowables.append(Spacer(1, 4))
        elif stripped.startswith("---"):
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceBefore=4, spaceAfter=6))
        else:
            flowables.append(Paragraph(clean_inline_md(stripped), styles["body"]))
            flowables.append(Spacer(1, 2))

        i += 1

    return flowables

def build_pdf_document(md_filename, pdf_filename, title_header):
    if not os.path.exists(md_filename):
        print(f"Skipping missing file: {md_filename}")
        return
    with open(md_filename, "r", encoding="utf-8") as f:
        content = f.read()

    os.makedirs(os.path.dirname(pdf_filename), exist_ok=True)
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=50,
        bottomMargin=50
    )
    styles = create_styles()
    flowables = parse_markdown_to_flowables(content, styles)
    
    # Configure NumberedCanvas title
    def canvas_factory(*args, **kwargs):
        c = NumberedCanvas(*args, **kwargs)
        c.doc_title = title_header
        return c

    doc.build(flowables, canvasmaker=canvas_factory)
    print(f"Generated PDF: {pdf_filename}")

def build_combined_pdf(doc_list, output_pdf):
    os.makedirs(os.path.dirname(output_pdf), exist_ok=True)
    doc = SimpleDocTemplate(
        output_pdf,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=50,
        bottomMargin=50
    )
    styles = create_styles()
    all_flowables = []

    for idx, (md_file, title_tag) in enumerate(doc_list):
        if not os.path.exists(md_file):
            continue
        with open(md_file, "r", encoding="utf-8") as f:
            content = f.read()
        flowables = parse_markdown_to_flowables(content, styles)
        all_flowables.extend(flowables)
        if idx < len(doc_list) - 1:
            all_flowables.append(PageBreak())

    def canvas_factory(*args, **kwargs):
        c = NumberedCanvas(*args, **kwargs)
        c.doc_title = "AGENT COMMERCE GATEWAY — COMPLETE EVIDENCE PACKAGE"
        return c

    doc.build(all_flowables, canvasmaker=canvas_factory)
    print(f"Generated Combined Package PDF: {output_pdf}")

def main():
    individual_mappings = [
        ("docs/00_EXECUTIVE_OVERVIEW.md", "reports/pdf/ACG_EXECUTIVE_OVERVIEW.pdf", "Executive Overview & Strategic Brief"),
        ("docs/01_ARCHITECTURE.md", "reports/pdf/ACG_ARCHITECTURE.pdf", "Technical Architecture & System Design"),
        ("docs/02_SECURITY_EVIDENCE.md", "reports/pdf/ACG_SECURITY_EVIDENCE.pdf", "Security Evidence & Threat Model"),
        ("docs/05_RAZORPAY_INTEGRATION.md", "reports/pdf/ACG_RAZORPAY_INTEGRATION.pdf", "Razorpay Integration & Rails"),
        ("docs/06_PROTOCOL_COMPATIBILITY.md", "reports/pdf/ACG_PROTOCOL_COMPATIBILITY.pdf", "Protocol Compatibility Matrix"),
        ("docs/10_ADVERSARIAL_TESTING.md", "reports/pdf/ACG_ADVERSARIAL_TEST_REPORT.pdf", "Adversarial & Pentest Report"),
        ("docs/08_PERFORMANCE_AND_ONBOARDING.md", "reports/pdf/ACG_PERFORMANCE.pdf", "Performance & Onboarding"),
        ("docs/11_PRODUCTION_GAP_ANALYSIS.md", "reports/pdf/ACG_PRODUCTION_GAP_ANALYSIS.pdf", "Production Gap Analysis"),
        ("docs/12_DEMO_RUNBOOK.md", "reports/pdf/ACG_DEMO_RUNBOOK.pdf", "Live Demo Runbook"),
        ("docs/13_EVALUATOR_ONE_PAGE.md", "reports/pdf/ACG_EVALUATOR_ONE_PAGE.pdf", "Evaluator One-Page Summary"),
        ("docs/14_FINAL_RELEASE_SIGNOFF.md", "reports/pdf/ACG_FINAL_RELEASE_SIGNOFF.pdf", "Final Release Verification Sign-Off"),
        ("docs/evolution/V2.md", "reports/pdf/ACG_V2_CONTROL_PLANE.pdf", "ACG V2 Agent Financial Control Plane"),
        ("docs/evolution/V3.md", "reports/pdf/ACG_V3_SECURITY_INFRASTRUCTURE.pdf", "ACG V3 Agent Security Infrastructure"),
        ("docs/evolution/V4.md", "reports/pdf/ACG_V4_UNIVERSAL_CONTROL_PLANE.pdf", "ACG V4 Universal Agent Control Plane"),
        ("docs/evolution/FINAL_EVOLUTION_REPORT.md", "reports/pdf/ACG_FINAL_EVOLUTION_REPORT.pdf", "ACG Final Evolution Report"),
    ]

    for md_path, pdf_path, header in individual_mappings:
        build_pdf_document(md_path, pdf_path, header)

    combined_order = [
        ("docs/00_EXECUTIVE_OVERVIEW.md", "Executive Overview"),
        ("docs/01_ARCHITECTURE.md", "Architecture"),
        ("docs/02_SECURITY_EVIDENCE.md", "Security Evidence"),
        ("docs/03_FINANCIAL_AUTHORIZATION.md", "Financial Authorization"),
        ("docs/04_CONCURRENCY_AND_DOUBLE_SPEND.md", "Concurrency & Double-Spend"),
        ("docs/05_RAZORPAY_INTEGRATION.md", "Razorpay Integration"),
        ("docs/06_PROTOCOL_COMPATIBILITY.md", "Protocol Compatibility"),
        ("docs/07_AUDIT_LEDGER.md", "Audit Ledger"),
        ("docs/08_PERFORMANCE_AND_ONBOARDING.md", "Performance & Onboarding"),
        ("docs/09_FRONTEND_VERIFICATION.md", "Frontend Verification"),
        ("docs/10_ADVERSARIAL_TESTING.md", "Adversarial Testing"),
        ("docs/11_PRODUCTION_GAP_ANALYSIS.md", "Production Gap Analysis"),
        ("docs/12_DEMO_RUNBOOK.md", "Demo Runbook"),
        ("docs/evolution/V2.md", "V2 Control Plane"),
        ("docs/evolution/V3.md", "V3 Security Infrastructure"),
        ("docs/evolution/V4.md", "V4 Universal Control Plane"),
        ("docs/evolution/EVOLUTION_SCORECARD.md", "Evolution Scorecard"),
        ("docs/evolution/FINAL_EVOLUTION_REPORT.md", "Final Evolution Report"),
        ("docs/14_FINAL_RELEASE_SIGNOFF.md", "Final Release Signoff"),
    ]

    build_combined_pdf(combined_order, "reports/pdf/ACG_FINAL_EVIDENCE_PACKAGE.pdf")
    print("\n✅ All release documentation PDFs successfully generated in reports/pdf/")

if __name__ == "__main__":
    main()
