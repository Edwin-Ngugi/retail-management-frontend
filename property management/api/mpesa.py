import base64
from datetime import datetime

import requests

from django.conf import settings


# =========================================================
# PHONE NUMBER NORMALIZATION
# =========================================================

def normalize_phone_number(phone_number):
    phone_number = (
        str(phone_number)
        .strip()
        .replace(" ", "")
        .replace("-", "")
    )

    if phone_number.startswith("+254"):
        return phone_number[1:]

    if phone_number.startswith("254"):
        return phone_number

    if phone_number.startswith("07") or phone_number.startswith("01"):
        return "254" + phone_number[1:]

    raise ValueError(
        "Invalid Kenyan phone number. Use 07XXXXXXXX, "
        "01XXXXXXXX, or 254XXXXXXXXX."
    )


# =========================================================
# MPESA SERVICE
# =========================================================

class MpesaService:

    # -----------------------------------------------------
    # NORMALIZE PHONE
    # -----------------------------------------------------

    @staticmethod
    def normalize_phone_number(phone_number):
        return normalize_phone_number(phone_number)

    # -----------------------------------------------------
    # GET ACCESS TOKEN
    # -----------------------------------------------------

    @staticmethod
    def get_access_token():

        url = (
            "https://sandbox.safaricom.co.ke/"
            "oauth/v1/generate?grant_type=client_credentials"
        )

        response = requests.get(
            url,
            auth=(
                settings.MPESA_CONSUMER_KEY,
                settings.MPESA_CONSUMER_SECRET,
            ),
            timeout=30,
        )

        print("========== MPESA ACCESS TOKEN ==========")
        print("Status:", response.status_code)
        print("Response:", response.text)
        print("========================================")

        response.raise_for_status()

        data = response.json()

        access_token = data.get("access_token")

        if not access_token:
            raise ValueError(
                f"M-Pesa access token missing. Response: {data}"
            )

        return access_token

    # -----------------------------------------------------
    # GENERATE PASSWORD
    # -----------------------------------------------------

    @staticmethod
    def generate_password(timestamp):

        raw_password = (
            str(settings.MPESA_SHORTCODE)
            + str(settings.MPESA_PASSKEY)
            + timestamp
        )

        encoded_password = base64.b64encode(
            raw_password.encode("utf-8")
        ).decode("utf-8")

        return encoded_password

    # -----------------------------------------------------
    # STK PUSH
    # -----------------------------------------------------

    @classmethod
    def stk_push(
        cls,
        phone_number,
        amount,
        account_reference,
        transaction_desc,
    ):

        # -------------------------------------------------
        # NORMALIZE PHONE
        # -------------------------------------------------

        phone_number = normalize_phone_number(phone_number)

        # -------------------------------------------------
        # CONVERT AMOUNT
        # -------------------------------------------------

        amount = int(amount)

        if amount <= 0:
            raise ValueError(
                "M-Pesa amount must be greater than zero."
            )

        # -------------------------------------------------
        # CLEAN ACCOUNT REFERENCE
        # -------------------------------------------------

        account_reference = str(account_reference).strip()

        # Keep it short
        if len(account_reference) > 12:
            account_reference = account_reference[:12]

        # -------------------------------------------------
        # CLEAN TRANSACTION DESCRIPTION
        # -------------------------------------------------

        transaction_desc = str(transaction_desc).strip()

        # Safaricom STK Push transaction description
        # should be kept short.
        if len(transaction_desc) > 13:
            transaction_desc = transaction_desc[:13]

        # -------------------------------------------------
        # GET ACCESS TOKEN
        # -------------------------------------------------

        access_token = cls.get_access_token()

        # -------------------------------------------------
        # TIMESTAMP
        # -------------------------------------------------

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")

        # -------------------------------------------------
        # PASSWORD
        # -------------------------------------------------

        password = cls.generate_password(timestamp)

        # -------------------------------------------------
        # STK PUSH URL
        # -------------------------------------------------

        url = (
            "https://sandbox.safaricom.co.ke/"
            "mpesa/stkpush/v1/processrequest"
        )

        # -------------------------------------------------
        # HEADERS
        # -------------------------------------------------

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        # -------------------------------------------------
        # CALLBACK URL
        # -------------------------------------------------

        callback_url = str(
            settings.MPESA_CALLBACK_URL
        ).strip()

        # -------------------------------------------------
        # PAYLOAD
        # -------------------------------------------------

        payload = {
            "BusinessShortCode": int(
                settings.MPESA_SHORTCODE
            ),

            "Password": password,

            "Timestamp": timestamp,

            "TransactionType": "CustomerPayBillOnline",

            "Amount": amount,

            "PartyA": phone_number,

            "PartyB": int(
                settings.MPESA_SHORTCODE
            ),

            "PhoneNumber": phone_number,

            "CallBackURL": callback_url,

            "AccountReference": account_reference,

            "TransactionDesc": transaction_desc,
        }

        # -------------------------------------------------
        # DEBUG OUTPUT
        # -------------------------------------------------

        print("\n")
        print("==========================================")
        print("       M-PESA STK PUSH REQUEST")
        print("==========================================")
        print("URL:", url)
        print("BusinessShortCode:", settings.MPESA_SHORTCODE)
        print("Phone:", phone_number)
        print("Amount:", amount)
        print("AccountReference:", account_reference)
        print("TransactionDesc:", transaction_desc)
        print("TransactionDesc Length:", len(transaction_desc))
        print("CallbackURL:", callback_url)
        print("Timestamp:", timestamp)
        print("==========================================")
        print("\n")

        # -------------------------------------------------
        # SEND REQUEST
        # -------------------------------------------------

        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=30,
        )

        # -------------------------------------------------
        # DEBUG SAFARICOM RESPONSE
        # -------------------------------------------------

        print("\n")
        print("==========================================")
        print("       M-PESA STK PUSH RESPONSE")
        print("==========================================")
        print("HTTP STATUS:", response.status_code)
        print("RESPONSE:", response.text)
        print("==========================================")
        print("\n")

        # -------------------------------------------------
        # HANDLE HTTP ERRORS
        # -------------------------------------------------

        if not response.ok:

            try:
                error_data = response.json()
            except ValueError:
                error_data = {
                    "raw_response": response.text
                }

            raise RuntimeError(
                f"M-Pesa STK Push failed "
                f"(HTTP {response.status_code}): "
                f"{error_data}"
            )

        # -------------------------------------------------
        # PARSE JSON
        # -------------------------------------------------

        try:
            data = response.json()
        except ValueError:
            raise RuntimeError(
                "M-Pesa returned an invalid JSON response: "
                + response.text
            )

        # -------------------------------------------------
        # RETURN RESPONSE
        # -------------------------------------------------

        return data