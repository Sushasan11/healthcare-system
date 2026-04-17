import enum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class NotificationType(str, enum.Enum):
    prescription_issued = "prescription_issued"
    consultation_reopened = "consultation_reopened"
    pharmacy_order_received = "pharmacy_order_received"
    pharmacy_order_status_changed = "pharmacy_order_status_changed"
    pharmacy_order_rejected = "pharmacy_order_rejected"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(String(1000), nullable=False)
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
