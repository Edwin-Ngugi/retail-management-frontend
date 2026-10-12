from io import BytesIO
from decimal import Decimal

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    PageBreak,
)


def generate_financial_report(
    property_obj,
    context
):

    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()

    story = []

    # ---------------------------------------------------------
    # TITLE
    # ---------------------------------------------------------

    story.append(
        Paragraph(
            "PropertyPro Financial Performance Report",
            styles["Title"]
        )
    )

    story.append(
        Paragraph(
            property_obj.name,
            styles["Heading2"]
        )
    )

    story.append(
        Paragraph(
            property_obj.address or "",
            styles["Normal"]
        )
    )

    story.append(Spacer(1, 10))

    # ---------------------------------------------------------
    # REPORT PERIOD
    # ---------------------------------------------------------

    period = (
        f"{context.get('start_date') or 'Beginning'} "
        f"to "
        f"{context.get('end_date') or 'Present'}"
    )

    story.append(
        Paragraph(
            f"<b>Reporting period:</b> {period}",
            styles["Normal"]
        )
    )

    story.append(Spacer(1, 15))

    # ---------------------------------------------------------
    # KPI TABLE
    # ---------------------------------------------------------

    kpi_data = [
        ["Financial Metric", "Amount"],

        [
            "Expected Revenue",
            f"KSh {context['total_expected']:,.2f}"
        ],

        [
            "Collected Rent",
            f"KSh {context['total_collected']:,.2f}"
        ],

        [
            "Outstanding Rent",
            f"KSh {context['outstanding_balance']:,.2f}"
        ],

        [
            "Overdue Rent",
            f"KSh {context['total_overdue']:,.2f}"
        ],

        [
            "Operating Expenses",
            f"KSh {context['total_expenses']:,.2f}"
        ],

        [
            "Net Operating Income",
            f"KSh {context['net_income']:,.2f}"
        ],

        [
            "Collection Rate",
            f"{context['collection_rate']}%"
        ],

        [
            "Occupancy Rate",
            f"{context['occupancy_rate']}%"
        ],

        [
            "Profit Margin",
            f"{context['profit_margin']}%"
        ],
    ]

    table = Table(
        kpi_data,
        colWidths=[100 * mm, 70 * mm]
    )

    table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.HexColor("#1e293b")
            ),

            (
                "TEXTCOLOR",
                (0, 0),
                (-1, 0),
                colors.white
            ),

            (
                "FONTNAME",
                (0, 0),
                (-1, 0),
                "Helvetica-Bold"
            ),

            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.5,
                colors.HexColor("#e2e8f0")
            ),

            (
                "ALIGN",
                (1, 1),
                (-1, -1),
                "RIGHT"
            ),

            (
                "FONTNAME",
                (0, 1),
                (-1, -1),
                "Helvetica"
            ),

            (
                "BOTTOMPADDING",
                (0, 0),
                (-1, -1),
                7
            ),

            (
                "TOPPADDING",
                (0, 0),
                (-1, -1),
                7
            ),
        ])
    )

    story.append(table)

    story.append(Spacer(1, 20))

    # ---------------------------------------------------------
    # REVENUE VS EXPENSE CHART
    # ---------------------------------------------------------

    labels = context["monthly_labels"]
    revenue = context["monthly_revenue"]
    expenses = context["monthly_expenses"]

    plt.figure(figsize=(9, 4.5))

    plt.plot(
        labels,
        revenue,
        marker="o",
        label="Revenue"
    )

    plt.plot(
        labels,
        expenses,
        marker="o",
        label="Expenses"
    )

    plt.title(
        "Monthly Revenue vs Operating Expenses"
    )

    plt.xlabel("Month")
    plt.ylabel("KSh")

    plt.xticks(
        rotation=45,
        ha="right"
    )

    plt.legend()

    plt.tight_layout()

    chart_buffer = BytesIO()

    plt.savefig(
        chart_buffer,
        format="png",
        dpi=160,
        bbox_inches="tight"
    )

    plt.close()

    chart_buffer.seek(0)

    story.append(
        Paragraph(
            "Revenue and Expense Trend",
            styles["Heading2"]
        )
    )

    story.append(
        Image(
            chart_buffer,
            width=175 * mm,
            height=85 * mm
        )
    )

    story.append(PageBreak())

    # ---------------------------------------------------------
    # EXPENSE BREAKDOWN
    # ---------------------------------------------------------

    story.append(
        Paragraph(
            "Expense Breakdown",
            styles["Heading2"]
        )
    )

    expense_labels = context[
        "expense_category_labels"
    ]

    expense_values = context[
        "expense_category_values"
    ]

    if expense_labels:

        plt.figure(figsize=(7, 5))

        plt.pie(
            expense_values,
            labels=expense_labels,
            autopct="%1.1f%%",
            startangle=90
        )

        plt.title(
            "Operating Expenses by Category"
        )

        plt.tight_layout()

        expense_chart = BytesIO()

        plt.savefig(
            expense_chart,
            format="png",
            dpi=160,
            bbox_inches="tight"
        )

        plt.close()

        expense_chart.seek(0)

        story.append(
            Image(
                expense_chart,
                width=150 * mm,
                height=100 * mm
            )
        )

    story.append(Spacer(1, 15))

    # ---------------------------------------------------------
    # EXPENSE TABLE
    # ---------------------------------------------------------

    expense_rows = [
        [
            "Date",
            "Category",
            "Description",
            "Amount"
        ]
    ]

    for expense in context["recent_expenses"]:

        expense_rows.append([
            expense.expense_date.strftime(
                "%d %b %Y"
            ),

            expense.get_category_display(),

            expense.description,

            f"KSh {expense.amount:,.2f}",
        ])

    if len(expense_rows) > 1:

        expense_table = Table(
            expense_rows,
            repeatRows=1,
            colWidths=[
                25 * mm,
                35 * mm,
                70 * mm,
                35 * mm,
            ]
        )

        expense_table.setStyle(
            TableStyle([
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#1e293b")
                ),

                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, 0),
                    colors.white
                ),

                (
                    "FONTNAME",
                    (0, 0),
                    (-1, 0),
                    "Helvetica-Bold"
                ),

                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.4,
                    colors.HexColor("#cbd5e1")
                ),

                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    8
                ),

                (
                    "ALIGN",
                    (-1, 1),
                    (-1, -1),
                    "RIGHT"
                ),
            ])
        )

        story.append(expense_table)

    story.append(PageBreak())

    # ---------------------------------------------------------
    # EXECUTIVE SUMMARY
    # ---------------------------------------------------------

    story.append(
        Paragraph(
            "Management Summary",
            styles["Heading2"]
        )
    )

    summary = (
        f"The property generated "
        f"KSh {context['total_collected']:,.2f} "
        f"in verified rental collections during "
        f"the reporting period. "
        f"Operating expenses amounted to "
        f"KSh {context['total_expenses']:,.2f}, "
        f"resulting in a net operating income of "
        f"KSh {context['net_income']:,.2f}. "
        f"The property recorded a collection rate "
        f"of {context['collection_rate']}% and an "
        f"occupancy rate of "
        f"{context['occupancy_rate']}%."
    )

    story.append(
        Paragraph(
            summary,
            styles["BodyText"]
        )
    )

    story.append(Spacer(1, 15))

    story.append(
        Paragraph(
            "Generated by PropertyPro Management System",
            styles["Normal"]
        )
    )

    document.build(story)

    buffer.seek(0)

    return buffer