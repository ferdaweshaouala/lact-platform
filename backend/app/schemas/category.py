from pydantic import BaseModel, Field
from typing import Optional, Literal


GradeKind = Literal["regular", "weekly", "bonus"]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    max_value: float = Field(gt=0)
    kind: GradeKind = "regular"
    order_index: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    max_value: Optional[float] = Field(default=None, gt=0)
    kind: Optional[GradeKind] = None
    order_index: Optional[int] = None


class CategoryOut(BaseModel):
    id: int
    course_id: int
    name: str
    max_value: float
    kind: GradeKind
    order_index: int

    class Config:
        from_attributes = True
