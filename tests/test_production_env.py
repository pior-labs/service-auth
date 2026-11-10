"""Execute actual workflow environment writers with synthetic secrets, without Docker."""
import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ('bootstrap-production.yml', 'deploy-production.yml')
SECRET = 'a1' * 32


def environment_writer(workflow):
    # Both release operations execute this same production writer. Keep testing
    # its real shell rather than duplicating its behavior in Python.
    source = (ROOT / '.github/workflows' / workflow).read_text()
    assert 'run: python3 scripts/deploy.py' in source
    return (ROOT / 'scripts/write-production-env.sh').read_text()


class ProductionEnvironment(unittest.TestCase):
    def run_writer(self, workflow, directory, auth_env, secret):
        environment = {
            'PATH': os.environ['PATH'],
            'AUTH_ENV': auth_env,
            'COMPOSE_FILE': 'docker-compose.yml:docker-compose.production.yml',
            'AUTH_DATABASE_URL_FILE': '/fixture/auth/database-url',
            'DATA_NETWORK': 'pior_data',
        }
        if secret is not None:
            environment['TASKS_CLIENT_SECRET'] = secret
        return subprocess.run(['bash', '-eu', '-c', environment_writer(workflow)],
                              cwd=directory, env=environment, text=True, capture_output=True)

    def test_separate_secret_wins_and_legacy_settings_are_preserved(self):
        for workflow in WORKFLOWS:
            with self.subTest(workflow=workflow), tempfile.TemporaryDirectory() as directory:
                source = ('BETTER_AUTH_SECRET=fixture-session\n'
                          'SEED_USER_1_PASSWORD="fixture password with spaces"\n'
                          'COOKBOOK_CLIENT_SECRET=fixture-cookbook\n'
                          'TASKS_CLIENT_SECRET=old\n'
                          ' export TASKS_CLIENT_SECRET = old-export\n'
                          'DATABASE_URL=fixture-database-must-be-removed\n')
                result = self.run_writer(workflow, directory, source, SECRET)
                self.assertEqual(result.returncode, 0, result.stderr)
                target = Path(directory) / '.env'
                content = target.read_text()
                self.assertIn('BETTER_AUTH_SECRET=fixture-session\n', content)
                self.assertIn('SEED_USER_1_PASSWORD="fixture password with spaces"\n', content)
                self.assertIn('COOKBOOK_CLIENT_SECRET=fixture-cookbook\n', content)
                self.assertEqual(content.count('TASKS_CLIENT_SECRET='), 1)
                self.assertIn('TASKS_CLIENT_SECRET=' + SECRET + '\n', content)
                self.assertNotIn('old-export', content)
                self.assertNotIn('fixture-database-must-be-removed', content)
                self.assertIn('AUTH_DATABASE_URL_FILE=/fixture/auth/database-url\n', content)
                self.assertEqual(target.stat().st_mode & 0o777, 0o600)
                self.assertNotIn(SECRET, result.stdout + result.stderr)

    def test_missing_or_invalid_secret_fails_before_changing_existing_file(self):
        for workflow in WORKFLOWS:
            for secret in (None, '', 'replace-me', 'f' * 63, 'f' * 65,
                           'f' * 64 + '\nINJECTED=yes', '$command-substitution'):
                with self.subTest(workflow=workflow, invalid=secret is None), tempfile.TemporaryDirectory() as directory:
                    target = Path(directory) / '.env'
                    target.write_text('preserve-existing-file\n')
                    result = self.run_writer(workflow, directory, 'OTHER=fixture\n', secret)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertEqual(target.read_text(), 'preserve-existing-file\n')
                    if secret:
                        self.assertNotIn(secret, result.stdout + result.stderr)

    def test_missing_auth_env_cannot_replace_existing_configuration(self):
        for workflow in WORKFLOWS:
            with self.subTest(workflow=workflow), tempfile.TemporaryDirectory() as directory:
                target = Path(directory) / '.env'
                target.write_text('preserve-existing-file\n')
                result = self.run_writer(workflow, directory, '', SECRET)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(target.read_text(), 'preserve-existing-file\n')


if __name__ == '__main__':
    unittest.main()
