"""Custom test-runner lifecycle hooks for InvenTree."""

from django_slowtests.testrunner import DiscoverSlowestTestsRunner


class InvenTreeTestRunner(DiscoverSlowestTestsRunner):
    """Synchronize process-wide services after creating the test database."""

    def setup_databases(self, **kwargs):
        """Create test databases, then bind the plugin registry to them."""
        old_config = super().setup_databases(**kwargs)

        from django.contrib.contenttypes.models import ContentType

        from plugin.registry import registry

        # ContentType IDs can differ between the application and test databases.
        # Clear the process-wide manager cache before any service accesses the
        # freshly-created test database.
        ContentType.objects.clear_cache()
        registry.synchronize_database()
        return old_config

    def teardown_databases(self, old_config, **kwargs):
        """Destroy test databases and discard database-specific content types."""
        super().teardown_databases(old_config, **kwargs)

        from django.contrib.contenttypes.models import ContentType

        ContentType.objects.clear_cache()
