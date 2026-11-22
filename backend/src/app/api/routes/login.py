"""Module for login and authentication endpoints."""

from datetime import timedelta
from typing import TYPE_CHECKING, Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi_utils.cbv import cbv

from app.api.deps import (
    CurrentSuperuser,
    CurrentUser,
    EmailManagerDep,
    ResendVerificationRateLimiter,
    SecurityManagerDep,
    SettingsDep,
    UserCrudDep,
)
from app.models import (
    Message,
    NewPassword,
    ResendVerificationRequest,
    Token,
    User,
    UserPublic,
    UserUpdate,
    VerifyEmailRequest,
)

if TYPE_CHECKING:
    from app.core.emails import Letter

__all__: tuple[str, ...] = ("login_router",)


OAuthFormDep = Annotated[OAuth2PasswordRequestForm, Depends()]

login_router: APIRouter = APIRouter()


@cbv(router=login_router)
class LoginRouter:
    """Class-based view for login and authentication endpoints."""

    def __init__(self, user_crud: UserCrudDep) -> None:
        """
        Initializes the LoginRouter class with the necessary dependencies.

        :param user_crud: Dependency for user CRUD operations.
        """
        self._user_crud: UserCrudDep = user_crud

    @login_router.post(
        path="/login/access-token",
        summary="Login for Access Token",
        description="OAuth2 compatible token login, get an access token for future requests.",
    )
    async def login_access_token(
        self, form_data: OAuthFormDep, security_manager: SecurityManagerDep, settings: SettingsDep
    ) -> Token:
        """
        Endpoint for user login to obtain an access token.

        :param form_data: The OAuth2 password request form data (username and password).
        :param security_manager: Dependency for security-related operations.
        :param settings: The application settings dependency.
        :return: An access token.
        :raises HTTPException: If login details are incorrect or the user is inactive.
        """
        user: User | None = await self._user_crud.authenticate(email=form_data.username, password=form_data.password)
        if not user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect email or password")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
        access_token_expires: timedelta = timedelta(minutes=settings.security.access_token_expire_minutes)
        return Token(
            access_token=security_manager.create_access_token(subject=str(user.id), expires_delta=access_token_expires)
        )

    @login_router.post(
        path="/login/test-token",
        response_model=UserPublic,
        summary="Test Access Token",
        description="Test endpoint to validate an access token.",
    )
    async def test_token(self, current_user: CurrentUser) -> User:
        """
        Endpoint to test the validity of an access token.

        :param current_user: The currently authenticated user.
        :return: The current user's public data.
        """
        return current_user

    @login_router.post(
        path="/password-recovery/{email}",
        summary="Recover Password",
        description="Send a password recovery email.",
    )
    async def recover_password(
        self, email: str, background_tasks: BackgroundTasks, email_manager: EmailManagerDep
    ) -> Message:
        """
        Endpoint to initiate password recovery for a user.

        The answer is the same whether the user exists or not, so that it does not reveal registered emails.

        :param email: The email address of the user.
        :param background_tasks: The background tasks service.
        :param email_manager: The email manager dependency.
        :return: A confirmation message.
        """
        user: User | None = await self._user_crud.get_by_email(email=email)
        if user:
            background_tasks.add_task(email_manager.send_reset_password_email, email_to=user.email)
        return Message(message="If an account with that email exists, a recovery email has been sent.")

    @login_router.post(
        path="/reset-password/",
        summary="Reset Password",
        description="Reset user password using a recovery token.",
    )
    async def reset_password(self, body: NewPassword, email_manager: EmailManagerDep) -> Message:
        """
        Endpoint to reset a user's password using a valid token.

        :param body: The request body containing the token and new password.
        :param email_manager: The email manager dependency.
        :return: A confirmation message.
        :raises HTTPException: If the token is invalid, the user is not found or inactive.
        """
        email: str | None = email_manager.verify_password_reset_token(token=body.token)
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")
        user: User | None = await self._user_crud.get_by_email(email=email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="The user with this email does not exist in the system."
            )
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
        # The link from the email proves that the user owns the address
        await self._user_crud.update(
            db_obj=user, obj_in=UserUpdate(password=body.new_password), update={"is_email_verified": True}
        )
        return Message(message="Password updated successfully")

    @login_router.post(
        path="/verify-email/",
        summary="Verify Email",
        description="Confirm the user's email address using the token from the verification email.",
    )
    async def verify_email(self, body: VerifyEmailRequest, email_manager: EmailManagerDep) -> Message:
        """
        Endpoint to confirm a user's email address.

        :param body: The request body containing the verification token.
        :param email_manager: The email manager dependency.
        :return: A confirmation message.
        :raises HTTPException: If the token is invalid or the user is not found.
        """
        email: str | None = email_manager.verify_email_verify_token(token=body.token)
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
        user: User | None = await self._user_crud.get_by_email(email=email)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if user.is_email_verified:
            return Message(message="This email has already been verified")
        await self._user_crud.update(db_obj=user, obj_in=UserUpdate(), update={"is_email_verified": True})
        return Message(message="Email verified successfully")

    @login_router.post(
        path="/resend-verification/",
        summary="Resend Verification Email",
        description="Send a new verification email to a user whose email is not verified yet. "
        "Limited to one request per minute per IP address.",
        dependencies=[ResendVerificationRateLimiter],
    )
    async def resend_verification_email(
        self, body: ResendVerificationRequest, background_tasks: BackgroundTasks, email_manager: EmailManagerDep
    ) -> Message:
        """
        Endpoint to resend a verification email.

        The answer is the same whether the user exists or not, so that it does not reveal registered emails.

        :param body: The request body containing the email address of the user.
        :param background_tasks: The background tasks service.
        :param email_manager: The email manager dependency.
        :return: A confirmation message.
        """
        user: User | None = await self._user_crud.get_by_email(email=body.email)
        if user and user.is_active and not user.is_email_verified:
            background_tasks.add_task(
                email_manager.send_verification_email, email_to=user.email, username=user.full_name or user.email
            )
        return Message(
            message="If an account with that email exists and is not yet verified, "
            "a new verification email has been sent."
        )

    @login_router.post(
        path="/password-recovery-html-content/{email}",
        response_class=HTMLResponse,
        summary="Get Password Recovery HTML Content",
        description="Get the HTML content of a password recovery email for preview (superusers only).",
    )
    async def recover_password_html_content(
        self, email: str, _: CurrentSuperuser, email_manager: EmailManagerDep
    ) -> HTMLResponse:
        """
        Endpoint to get the HTML content of a password recovery email.

        :param email: The email address to generate the content for.
        :param _: The superuser dependency to enforce permissions.
        :param email_manager: The email manager dependency.
        :return: An HTML response with the email content.
        """
        letter: Letter = await email_manager.render_reset_password_email(email_to=email)
        return HTMLResponse(content=letter.html, headers={"subject": letter.subject})
