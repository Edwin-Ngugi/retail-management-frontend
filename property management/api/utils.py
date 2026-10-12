import re


def normalize_phone_number(phone_number):
    """
    Normalize a Kenyan phone number to the format:

        2547XXXXXXXX

    Accepted examples:

        0722000000
        0722 000 000
        0722-000-000
        +254722000000
        254722000000

    Returns:
        str: normalized phone number

    Raises:
        ValueError: if the phone number is invalid
    """

    if not phone_number:
        raise ValueError("Phone number is required.")

    # Convert to string and remove spaces, hyphens and brackets
    phone_number = str(phone_number).strip()

    phone_number = re.sub(
        r"[\s\-\(\)]",
        "",
        phone_number
    )

    # -------------------------------------------------
    # +254XXXXXXXXX
    # -------------------------------------------------

    if phone_number.startswith("+254"):

        phone_number = phone_number[1:]

    # -------------------------------------------------
    # 07XXXXXXXX
    # -------------------------------------------------

    elif phone_number.startswith("07"):

        phone_number = (
            "254" +
            phone_number[1:]
        )

    # -------------------------------------------------
    # 01XXXXXXXX
    # -------------------------------------------------

    elif phone_number.startswith("01"):

        phone_number = (
            "254" +
            phone_number[1:]
        )

    # -------------------------------------------------
    # Already 254XXXXXXXXX
    # -------------------------------------------------

    elif phone_number.startswith("254"):

        pass

    else:

        raise ValueError(
            "Invalid Kenyan phone number. "
            "Use 07XXXXXXXX, 01XXXXXXXX, "
            "+254XXXXXXXXX or 254XXXXXXXXX."
        )

    # -------------------------------------------------
    # Validate final format
    # -------------------------------------------------

    if not re.fullmatch(
        r"254[17]\d{8}",
        phone_number
    ):
        raise ValueError(
            "Invalid Kenyan phone number."
        )

    return phone_number