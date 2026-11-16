import io
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from pathlib import Path
from app.core.config import settings
from app.core.logging import get_logger

_log = get_logger("dtms.email")

# Compress the logo once at import time for use as a CID attachment
_LOGO_BYTES: bytes | None = None
_LOGO_PATH = Path(__file__).parent / "logo.jpg"
try:
    from PIL import Image
    if _LOGO_PATH.exists():
        _img = Image.open(_LOGO_PATH).convert("RGB")
        _w, _h = _img.size
        _max_w = 220
        if _w > _max_w:
            _img = _img.resize((_max_w, int(_h * _max_w / _w)), Image.LANCZOS)
        _buf = io.BytesIO()
        _img.save(_buf, format="JPEG", quality=55, optimize=True)
        _LOGO_BYTES = _buf.getvalue()
except Exception:
    pass  # PIL not installed or logo missing — fall back to text wordmark


def _logo_html() -> str:
    if _LOGO_BYTES or _LOGO_PATH.exists():
        return (
            "<img src='cid:logo_cid' "
            "alt='LAC-T-Online' "
            "style='height:64px;width:auto;display:block;margin:0 auto;border-radius:8px;' />"
        )
    # Fallback text wordmark
    return (
        "<div style='display:inline-block;padding:10px 22px;background:#ffffff;"
        "border-radius:12px;'>"
        "<span style='font-family:\"Syne\",\"Segoe UI\",Arial,sans-serif;"
        "font-size:22px;font-weight:800;color:#10B981;letter-spacing:0.5px;'>"
        "LAC-T-Online</span></div>"
    )


def _attach_logo(msg: MIMEMultipart) -> None:
    """Attach logo as inline CID image if available."""
    logo_bytes = _LOGO_BYTES
    if logo_bytes is None and _LOGO_PATH.exists():
        logo_bytes = _LOGO_PATH.read_bytes()
    if logo_bytes:
        img_part = MIMEImage(logo_bytes, "jpeg")
        img_part.add_header("Content-ID", "<logo_cid>")
        img_part.add_header("Content-Disposition", "inline", filename="logo.jpg")
        msg.attach(img_part)


def _build_email(to_email: str, to_name: str, invite_link: str, is_reset: bool) -> MIMEMultipart:
    if is_reset:
        subject = "إعادة تعيين كلمة المرور — LAC-T-Online"
        heading = "طلب إعادة تعيين كلمة المرور"
        body = (
            "تلقّينا طلبًا لإعادة تعيين كلمة مرور حسابكِ في منصة <strong>LAC-T-Online</strong>.<br>"
            "الرجاء الضغط على الزر أدناه لاختيار كلمة مرور جديدة."
        )
        btn_label = "إعادة تعيين كلمة المرور"
        footer_extra = "• إذا لم تطلبي إعادة التعيين، يمكنكِ تجاهل هذا البريد بكل أمان."
    else:
        subject = "دعوة للانضمام إلى منصة LAC-T-Online"
        heading = "مرحبًا بكِ في LAC-T-Online"
        body = (
            "يسعدنا دعوتكِ للانضمام إلى منصة <strong>LAC-T-Online</strong>، منصة إدارة التدريب الرقمي.<br>"
            "الرجاء الضغط على الزر أدناه لتعيين كلمة مرورك وتفعيل حسابك."
        )
        btn_label = "تفعيل الحساب"
        footer_extra = "• إذا لم تكوني تتوقعين هذه الدعوة، يمكنكِ تجاهل هذا البريد بكل أمان."

    html = f"""
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#10B981,#059669);padding:28px 36px;text-align:center;">
        {_logo_html()}
        <p style="color:rgba(255,255,255,0.9);font-size:13px;margin:14px 0 0;">منصة إدارة التدريب الرقمي</p>
      </div>
      <div style="padding:36px;">
        <div dir="rtl" style="text-align:right;">
          <p style="color:#0F172A;font-size:18px;font-weight:700;margin:0 0 4px;font-family:'Segoe UI',Arial,sans-serif;">السلام عليكم ورحمة الله وبركاته،</p>
          <p style="color:#0F172A;font-size:16px;font-weight:600;margin:0 0 8px;">عزيزتي {to_name}،</p>
          <p style="color:#0F172A;font-size:15px;font-weight:700;margin:0 0 12px;">{heading}</p>
          <p style="color:#475569;font-size:14px;line-height:1.8;margin:0 0 24px;">{body}</p>
          <div style="text-align:center;margin:8px 0 24px;">
            <a href="{invite_link}"
               style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#10B981,#059669);color:white;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700;font-family:'Segoe UI',Arial,sans-serif;">
              {btn_label}
            </a>
          </div>
          <p style="color:#94A3B8;font-size:12px;margin:0;line-height:1.8;">
            • هذا الرابط صالح لمدة <strong>7 أيام</strong> ويمكن استخدامه مرة واحدة فقط.<br>
            {footer_extra}
          </p>
        </div>
      </div>
    </div>
    """

    # multipart/related lets the HTML body reference the logo via cid:
    msg = MIMEMultipart("related")
    msg["Subject"] = subject
    msg["From"] = f"LAC-T-Online <{settings.SMTP_USER}>"
    msg["To"] = to_email
    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(html, "html"))
    msg.attach(alt)
    _attach_logo(msg)
    return msg


def send_invite_email(to_email: str, to_name: str, invite_link: str, is_reset: bool = False) -> None:
    """Send an invite or password-reset email via Gmail SMTP."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        _log.warning("email_skipped", reason="SMTP not configured", to=to_email, is_reset=is_reset)
        return

    try:
        msg = _build_email(to_email, to_name, invite_link, is_reset)
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
        _log.info("email_sent", to=to_email, is_reset=is_reset)
    except Exception as exc:
        _log.warning("email_failed", to=to_email, is_reset=is_reset, error=str(exc))


def _build_notification(to_email: str, subject: str, heading: str, body_html: str) -> MIMEMultipart:
    html = f"""
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0EA5E9,#0284C7);padding:24px 32px;text-align:center;">
        {_logo_html()}
        <p style="color:rgba(255,255,255,0.9);font-size:13px;margin:10px 0 0;">LAC-T-Online · DTMS</p>
      </div>
      <div style="padding:28px 32px;" dir="auto">
        <p style="color:#0F172A;font-size:16px;font-weight:700;margin:0 0 12px;">{heading}</p>
        <div style="color:#334155;font-size:14px;line-height:1.7;">{body_html}</div>
      </div>
    </div>
    """
    msg = MIMEMultipart("related")
    msg["Subject"] = subject
    msg["From"] = f"LAC-T-Online <{settings.SMTP_USER}>"
    msg["To"] = to_email
    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(html, "html"))
    msg.attach(alt)
    _attach_logo(msg)
    return msg


def send_notification(to_email: str, subject: str, heading: str, body_html: str) -> None:
    """Fire-and-forget notification email. Silently no-ops if SMTP isn't configured."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD or not to_email:
        return
    try:
        msg = _build_notification(to_email, subject, heading, body_html)
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
    except Exception as exc:
        _log.warning("notification_failed", to=to_email, subject=subject, error=str(exc))
