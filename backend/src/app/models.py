"""Data models for the application using Pydantic and SQLModel."""

from typing import Annotated
from uuid import UUID, uuid4

from pydantic import AfterValidator, BaseModel, EmailStr
from pydantic import Field as PydanticField
from sqlmodel import Field, Relationship, SQLModel

from app.core.common_passwords import COMMON_PASSWORDS

__all__: tuple[str, ...] = (
    "Item",
    "ItemBase",
    "ItemCreate",
    "ItemPublic",
    "ItemUpdate",
    "ItemsPublic",
    "Message",
    "NewPassword",
    "PasswordRecoveryRequest",
    "ResendVerificationRequest",
    "Token",
    "UpdatePassword",
    "User",
    "UserBase",
    "UserCreate",
    "UserPublic",
    "UserRegister",
    "UserUpdate",
    "UserUpdateMe",
    "UsersPublic",
    "VerifyEmailRequest",
)


# bcrypt hashes only the first 72 bytes of a password, so a longer one is rejected instead of being cut silently
PASSWORD_MAX_BYTES: int = 72


def _lower(value: str) -> str:
    """
    Lowercases an email address: addresses that differ only in case are one account.

    :param value: The validated address.
    :return: The address in lower case.
    """
    return value.lower()


def _reject_nul(value: str) -> str:
    """
    Rejects the NUL character, which PostgreSQL cannot store in a text column.

    :param value: The text.
    :return: The text unchanged.
    :raises ValueError: If the text contains NUL.
    """
    if "\x00" in value:
        raise ValueError("The NUL character is not allowed")
    return value


def _reject_null[T](value: T | None) -> T:
    """
    Rejects an explicit null for a field that an update may leave out but may not clear.

    The default of an omitted field is not validated, so leaving the field out still works.

    :param value: The value sent by the client.
    :return: The value unchanged.
    :raises ValueError: If the value is null.
    """
    if value is None:
        raise ValueError("null is not allowed: leave the field out to keep its value")
    return value


def _validate_new_password(value: str) -> str:
    """
    Checks a password that is being set: it fits into bcrypt whole and is not one of the most common ones.

    :param value: The password.
    :return: The password unchanged.
    :raises ValueError: If the password is longer than 72 bytes in UTF-8 or is too common.
    """
    if len(value.encode(encoding="utf-8")) > PASSWORD_MAX_BYTES:
        raise ValueError(f"The password must be at most {PASSWORD_MAX_BYTES} bytes long in UTF-8")
    if value.lower() in COMMON_PASSWORDS:
        raise ValueError("This password is too common")
    return value


Email = Annotated[EmailStr, AfterValidator(_lower)]
Text = Annotated[str, AfterValidator(_reject_nul)]
# A password that is being set (sign-up, change, reset); a current password is only compared, never validated
NewPasswordStr = Annotated[str, AfterValidator(_validate_new_password)]


# Shared properties
class UserBase(SQLModel):
    """
    General properties shared among all user models.

    :param email: Email address of the user.
    :param is_active: Whether the user is active or not.
    :param is_email_verified: Whether the user has confirmed their email address.
    :param is_superuser: Whether the user is a superuser or not.
    :param full_name: Full name of the user (optional).
    """

    email: Email = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_email_verified: bool = False
    is_superuser: bool = False
    full_name: Text | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    """
    Model for creating a new user via API.

    :param password: Password of the user.
    """

    password: NewPasswordStr = Field(min_length=8, max_length=PASSWORD_MAX_BYTES)


class UserRegister(SQLModel):
    """
    Model for registering a new user.

    :param email: Email address of the user.
    :param password: Password of the user.
    :param full_name: Full name of the user (optional).
    """

    email: Email = Field(max_length=255)
    password: NewPasswordStr = Field(min_length=8, max_length=PASSWORD_MAX_BYTES)
    full_name: Text | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    """
    Model for updating user data.

    :param email: Email address of the user (optional).
    :param password: Password of the user (optional).
    """

    # Update schemas make the base fields optional (the SQLModel pattern)
    email: Annotated[Email | None, AfterValidator(_reject_null)] = Field(  # pyright: ignore[reportIncompatibleVariableOverride]
        default=None, max_length=255
    )
    password: NewPasswordStr | None = Field(default=None, min_length=8, max_length=PASSWORD_MAX_BYTES)


class UserUpdateMe(BaseModel):
    """
    Model for updating the current user's data.

    :param full_name: Full name of the user (optional).
    :param email: Email address of the user (optional).
    :param current_password: Current password of the user; required to change the email address.
    """

    full_name: Text | None = PydanticField(default=None, max_length=255)
    email: Annotated[Email | None, AfterValidator(_reject_null)] = PydanticField(default=None, max_length=255)
    current_password: str | None = PydanticField(default=None, max_length=PASSWORD_MAX_BYTES)


class UpdatePassword(BaseModel):
    """
    Model for updating user passwords.

    :param current_password: Current password of the user.
    :param new_password: New password of the user.
    """

    current_password: str = PydanticField(min_length=8, max_length=PASSWORD_MAX_BYTES)
    new_password: NewPasswordStr = PydanticField(min_length=8, max_length=PASSWORD_MAX_BYTES)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    """
    The 'user' table model in the database.

    :param id: UUID of the user.
    :param hashed_password: Hashed password of the user.
    :param token_version: Version of the tokens of the user; a token of another version is rejected.
    :param items: List of items owned by the user.
    """

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    hashed_password: str
    # Carried by every access and password reset token; raising it revokes all the tokens issued before
    token_version: int = Field(default=0)
    # sqlmodel types Relationship() as Any; the annotation gives the real type
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)  # pyright: ignore[reportAny]


# Properties to return via API, id is always required
class UserPublic(UserBase):
    """
    Public user model returned via API (without password hash).

    :param id: UUID of the user.
    """

    id: UUID


class UsersPublic(BaseModel):
    """
    A model for returning a list of users with pagination.

    :param data: List of users.
    :param count: Total number of users.
    """

    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    """
    General properties shared by all models of a product.

    :param title: Title of the product.
    :param description: Description of the product (optional).
    """

    title: Text = Field(min_length=1, max_length=255)
    description: Text | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    """A model for creating a new product via API."""


# Properties to receive on item update
class ItemUpdate(ItemBase):
    """
    Model for updating product data.

    :param title: Title of the product (optional).
    """

    # Update schemas make the base fields optional (the SQLModel pattern)
    title: Annotated[Text | None, AfterValidator(_reject_null)] = Field(  # pyright: ignore[reportIncompatibleVariableOverride]
        default=None, min_length=1, max_length=255
    )


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    """
    The 'item' table model in the database.

    :param id: UUID of the product.
    :param owner_id: UUID of the user who owns the product.
    :param owner: User who owns the product.
    """

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    owner_id: UUID = Field(foreign_key="user.id", nullable=False)
    # sqlmodel types Relationship() as Any; the annotation gives the real type
    # Loaded together with the item (a JOIN): the public schema shows the owner's email
    owner: User = Relationship(  # pyright: ignore[reportAny]
        back_populates="items", sa_relationship_kwargs={"lazy": "joined", "innerjoin": True}
    )

    @property
    def owner_email(self) -> str:
        """
        The email of the owner, for the public schema.

        :return: The email address.
        """
        return self.owner.email


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    """
    Public model of a product returned via API.

    :param id: UUID of the product.
    :param owner_id: UUID of the user who owns the product.
    :param owner_email: Email of the user who owns the product.
    """

    id: UUID
    owner_id: UUID
    owner_email: EmailStr


class ItemsPublic(BaseModel):
    """
    A model for returning a list of items with pagination.

    :param data: List of items.
    :param count: Total number of items.
    """

    data: list[ItemPublic]
    count: int


# Generic message
class Message(BaseModel):
    """
    A model for sending simple text messages.

    :param message: Text message.
    """

    message: str


# JSON payload containing access token
class Token(BaseModel):
    """
    Response model with JWT access token.

    :param access_token: JWT access token.
    :param token_type: Type of token.
    """

    access_token: str
    token_type: str = "bearer"  # noqa: S105 - the OAuth2 token type, not a password


class NewPassword(BaseModel):
    """
    A model for setting a new password using a reset token.

    :param token: Reset token.
    :param new_password: New password.
    """

    token: str
    new_password: NewPasswordStr = PydanticField(min_length=8, max_length=PASSWORD_MAX_BYTES)


class VerifyEmailRequest(BaseModel):
    """
    A model for confirming an email address with the token from the verification email.

    :param token: Email verification token.
    """

    token: str


class ResendVerificationRequest(BaseModel):
    """
    A model for requesting a new verification email.

    :param email: The email address of the user.
    """

    email: Email


class PasswordRecoveryRequest(BaseModel):
    """
    A model for requesting a password recovery email.

    :param email: The email address of the account.
    """

    email: Email
