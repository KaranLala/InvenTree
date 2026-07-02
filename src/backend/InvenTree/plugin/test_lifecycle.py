"""Tests for plugin registry lifecycle ownership."""

import importlib
from unittest import mock

from django.contrib.contenttypes.models import ContentType
from django.test import SimpleTestCase, TestCase

from django_slowtests.testrunner import DiscoverSlowestTestsRunner

from InvenTree.test_runner import InvenTreeTestRunner
from plugin.apps import PluginAppConfig
from plugin.models import PluginConfig
from plugin.registry import registry


class PluginAppConfigTest(SimpleTestCase):
    """Tests for guarded process-wide plugin initialization."""

    def setUp(self):
        """Construct the plugin application configuration."""
        self.app_config = PluginAppConfig('plugin', importlib.import_module('plugin'))

    def test_ready_registry_is_not_reinitialized(self):
        """An initialized registry must not be initialized again."""
        original_ready = registry.ready
        registry.ready = True

        try:
            with (
                mock.patch('plugin.apps.isInMainThread', return_value=True),
                mock.patch('plugin.apps.canAppAccessDatabase', return_value=True),
                mock.patch.object(registry, 'set_ready') as set_ready,
                mock.patch('plugin.apps.set_maintenance_mode') as maintenance,
            ):
                self.app_config.reload_plugin_registry()

            set_ready.assert_not_called()
            maintenance.assert_not_called()
        finally:
            registry.ready = original_ready

    def test_unready_registry_is_initialized_once(self):
        """An uninitialized registry is initialized at application startup."""
        original_ready = registry.ready
        registry.ready = False

        try:
            with (
                mock.patch('plugin.apps.isInMainThread', return_value=True),
                mock.patch('plugin.apps.canAppAccessDatabase', return_value=True),
                mock.patch.object(registry, 'set_ready') as set_ready,
                mock.patch('plugin.apps.set_maintenance_mode') as maintenance,
            ):
                self.app_config.reload_plugin_registry()

            set_ready.assert_called_once_with()
            maintenance.assert_called_once_with(False)
        finally:
            registry.ready = original_ready


class PluginRegistrySynchronizationTest(SimpleTestCase):
    """Tests for explicit database synchronization."""

    def test_synchronize_database_reloads_cleanly(self):
        """Synchronization reloads plugins against the active database."""
        original_errors = registry.errors
        original_ready = registry.ready
        registry.errors = {'old': ['error']}
        registry.ready = True

        try:
            with mock.patch.object(registry, 'reload_plugins') as reload_plugins:
                registry.synchronize_database()

            self.assertEqual(registry.errors, {})
            reload_plugins.assert_called_once_with(
                full_reload=True, force_reload=True, collect=True, clear_errors=True
            )
        finally:
            registry.errors = original_errors
            registry.ready = original_ready


class InvenTreeTestRunnerTest(SimpleTestCase):
    """Tests for the test database lifecycle hook."""

    def test_registry_sync_runs_after_database_setup(self):
        """The registry is synchronized after the database is available."""
        runner = InvenTreeTestRunner(verbosity=0)
        old_config = object()
        calls = []

        with (
            mock.patch.object(
                DiscoverSlowestTestsRunner, 'setup_databases', return_value=old_config
            ) as setup_databases,
            mock.patch.object(
                ContentType.objects,
                'clear_cache',
                side_effect=lambda: calls.append('clear_content_types'),
            ) as clear_cache,
            mock.patch.object(
                registry,
                'synchronize_database',
                side_effect=lambda: calls.append('synchronize_registry'),
            ) as synchronize,
        ):
            result = runner.setup_databases(aliases={'default': False})

        setup_databases.assert_called_once_with(aliases={'default': False})
        clear_cache.assert_called_once_with()
        synchronize.assert_called_once_with()
        self.assertEqual(calls, ['clear_content_types', 'synchronize_registry'])
        self.assertIs(result, old_config)

    def test_content_type_cache_is_cleared_after_database_teardown(self):
        """Database-specific content types are discarded after test teardown."""
        runner = InvenTreeTestRunner(verbosity=0)
        old_config = object()

        with (
            mock.patch.object(
                DiscoverSlowestTestsRunner, 'teardown_databases'
            ) as teardown_databases,
            mock.patch.object(ContentType.objects, 'clear_cache') as clear_cache,
        ):
            runner.teardown_databases(old_config, keepdb=False)

        teardown_databases.assert_called_once_with(old_config, keepdb=False)
        clear_cache.assert_called_once_with()


class PluginDatabaseSynchronizationTest(TestCase):
    """Integration tests for the synchronized test-database baseline."""

    def test_plugin_configs_exist(self):
        """Plugin configuration is populated before test transactions start."""
        self.assertTrue(registry.is_ready)
        self.assertGreater(PluginConfig.objects.count(), 0)
