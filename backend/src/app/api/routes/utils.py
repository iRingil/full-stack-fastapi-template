"""Module for utility endpoints."""

from fastapi import APIRouter, BackgroundTasks
from fastapi_utils.cbv import cbv
from pydantic.networks import EmailStr

from app.api.deps import CurrentSuperuser, EmailManagerDep
from app.models import Message

__all__: tuple[str, ...] = ("utils_router",)


utils_router: APIRouter = APIRouter()


@cbv(router=utils_router)
class UtilsRouter:
    """Class-based view for utility endpoints."""

    @utils_router.post(
        path="/test-email/",
        status_code=202,
        summary="Test emails",
        description="Send a test email.",
    )
    async def test_email(
        self,
        email_to: EmailStr,
        background_tasks: BackgroundTasks,
        email_manager: EmailManagerDep,
        _: CurrentSuperuser,  # noqa: PT019 - a route, not a pytest test: Ruff goes by the name test_*
    ) -> Message:
        """
        Endpoint for testing the email system.

        :param email_to: The email address of the recipient.
        :param background_tasks: The background tasks service.
        :param email_manager: The email manager dependency.
        :param _: The current superuser.

        :return: A message indicating that the email has been sent.
        """
        background_tasks.add_task(email_manager.send_test_email, email_to=email_to)
        return Message(message="Test email sent")

    @utils_router.get(path="/health-check/", summary="Health check", description="Health check.")
    async def health_check(self) -> Message:
        """
        Simple health check endpoint.

        :return: A message indicating that the application is running.
        """
        return Message(message="Ok")
