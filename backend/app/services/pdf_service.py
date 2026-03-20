from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable


def generate_prescription_pdf(data: dict) -> bytes:
    """Generate professional prescription PDF.

    data keys:
      id, issued_at (str "DD MMM YYYY"), status,
      doctor_name, doctor_specialty, doctor_license,
      patient_name, diagnosis, items: list[dict with medicine_name, dosage_amount, dosage_unit, frequency, duration, instructions]
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, topMargin=40, bottomMargin=40, leftMargin=50, rightMargin=50
    )
    styles = getSampleStyleSheet()
    story = []

    # -- Header --
    header_data = [["HealthConnect", "PRESCRIPTION"]]
    header_table = Table(header_data, colWidths=[250, 250])
    header_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (0, 0), 14),
        ("FONTNAME", (1, 0), (1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (1, 0), (1, 0), 14),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1, color=colors.black))
    story.append(Spacer(1, 8))

    # -- Issue metadata --
    cell_style = ParagraphStyle("cell", parent=styles["Normal"], fontSize=9, leading=12)
    meta_text = f"Date: {data['issued_at']}    Prescription ID: #{data['id']}"
    story.append(Paragraph(
        meta_text,
        ParagraphStyle("meta", parent=styles["Normal"], fontSize=10, alignment=2)
    ))
    story.append(Spacer(1, 12))

    # -- Doctor block --
    story.append(Paragraph(
        "Prescribing Doctor",
        ParagraphStyle("section", parent=styles["Normal"], fontSize=10, textColor=colors.grey)
    ))
    story.append(Paragraph(
        data["doctor_name"],
        ParagraphStyle("doc", parent=styles["Normal"], fontSize=12, leading=16, fontName="Helvetica-Bold")
    ))
    if data.get("doctor_specialty"):
        story.append(Paragraph(data["doctor_specialty"], cell_style))
    if data.get("doctor_license"):
        story.append(Paragraph(f"License: {data['doctor_license']}", cell_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
    story.append(Spacer(1, 8))

    # -- Patient block --
    story.append(Paragraph(
        "Patient",
        ParagraphStyle("section", parent=styles["Normal"], fontSize=10, textColor=colors.grey)
    ))
    story.append(Paragraph(
        data["patient_name"],
        ParagraphStyle("pat", parent=styles["Normal"], fontSize=12, leading=16, fontName="Helvetica-Bold")
    ))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
    story.append(Spacer(1, 8))

    # -- Diagnosis --
    story.append(Paragraph(
        "Diagnosis / Clinical Notes",
        ParagraphStyle("section", parent=styles["Normal"], fontSize=10, textColor=colors.grey)
    ))
    story.append(Paragraph(data["diagnosis"], cell_style))
    story.append(Spacer(1, 12))

    # -- Medicines table --
    page_width = A4[0] - 100  # minus margins
    col_widths = [
        page_width * 0.30,
        page_width * 0.15,
        page_width * 0.18,
        page_width * 0.12,
        page_width * 0.25,
    ]
    table_data = [["Medicine", "Dosage", "Frequency", "Duration", "Instructions"]]
    for item in data["items"]:
        table_data.append([
            Paragraph(item["medicine_name"], cell_style),
            Paragraph(f"{item['dosage_amount']} {item['dosage_unit']}", cell_style),
            Paragraph(item["frequency"], cell_style),
            Paragraph(item["duration"], cell_style),
            Paragraph(item.get("instructions") or "-", cell_style),
        ])

    med_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table_styles = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.94, 0.94, 0.94)),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.Color(0.89, 0.91, 0.94)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    # Alternating row fill
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            table_styles.append(
                ("BACKGROUND", (0, i), (-1, i), colors.Color(0.97, 0.98, 0.99))
            )
    med_table.setStyle(TableStyle(table_styles))
    story.append(med_table)
    story.append(Spacer(1, 20))

    # -- Footer --
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
    footer_data = [[f"Status: {data['status']}", f"Issued via HealthConnect — {data['issued_at']}"]]
    footer_table = Table(footer_data, colWidths=[250, 250])
    footer_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.grey),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(footer_table)

    doc.build(story)
    return buffer.getvalue()
