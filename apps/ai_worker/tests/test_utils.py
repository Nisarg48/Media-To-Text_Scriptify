"""
Unit tests for pure functions in main.py.

We use importlib to load only the functions we need without triggering
module-level side effects (torch, whisper, pika, minio, pymongo, etc.).
All heavy imports are patched before main.py is imported.
"""
import sys
import types
import unittest
from unittest.mock import MagicMock, patch


def _stub_module(name, attrs=None):
    """Register a minimal stub module so main.py can import without the real library."""
    parts = name.split('.')
    for i in range(1, len(parts) + 1):
        full = '.'.join(parts[:i])
        if full not in sys.modules:
            mod = types.ModuleType(full)
            sys.modules[full] = mod
    if attrs:
        mod = sys.modules[name]
        for k, v in attrs.items():
            setattr(mod, k, v)
    return sys.modules[name]


def _patch_imports():
    """Patch all heavy/side-effect imports so main.py can be loaded in tests."""
    # torch
    torch_mod = _stub_module('torch')
    torch_mod.cuda = MagicMock()
    torch_mod.cuda.is_available = MagicMock(return_value=False)
    torch_mod.cuda.get_device_name = MagicMock(return_value='CPU')

    # whisper
    whisper_mod = _stub_module('whisper')
    whisper_mod.load_model = MagicMock(return_value=MagicMock())

    # pika
    _stub_module('pika')

    # minio
    minio_mod = _stub_module('minio')
    minio_mod.Minio = MagicMock()

    # pymongo
    pymongo_mod = _stub_module('pymongo')
    pymongo_mod.MongoClient = MagicMock(return_value=MagicMock())

    # bson
    bson_mod = _stub_module('bson')
    bson_mod.objectid = _stub_module('bson.objectid')
    bson_mod.objectid.ObjectId = MagicMock(side_effect=lambda x: x)

    # google.genai
    google_mod = _stub_module('google')
    google_mod.genai = _stub_module('google.genai')
    google_mod.genai.Client = MagicMock()

    # dotenv
    dotenv_mod = _stub_module('dotenv')
    dotenv_mod.load_dotenv = MagicMock()


_patch_imports()

import os
os.environ.setdefault('RABBITMQ_URL', 'amqp://guest:guest@localhost/')
os.environ.setdefault('RABBITMQ_QUEUE', 'test')
os.environ.setdefault('STORAGE_ENDPOINT', 'localhost:9000')
os.environ.setdefault('STORAGE_ACCESS_KEY', 'minioadmin')
os.environ.setdefault('STORAGE_SECRET_KEY', 'minioadmin')
os.environ.setdefault('STORAGE_BUCKET_NAME', 'media')
os.environ.setdefault('MONGODB_URL', 'mongodb://localhost:27017')
os.environ.setdefault('MONGODB_DATABASE_NAME', 'test')
os.environ.setdefault('SUPPORTED_EXTENSIONS', '.mp4,.mp3,.wav,.m4a,.mov,.avi,.mkv')
os.environ.setdefault('GEMINI_API_KEY', '')

import importlib
main = importlib.import_module('main')


class TestValidateAndFixSegments(unittest.TestCase):
    def _seg(self, start, end, text):
        return {"start": start, "end": end, "text": text}

    def test_returns_same_count_when_matching(self):
        orig = [self._seg(0, 1, "hello"), self._seg(1, 2, "world")]
        translated = [self._seg(0, 1, "hola"), self._seg(1, 2, "mundo")]
        fixed, ok = main._validate_and_fix_segments(translated, orig)
        self.assertTrue(ok)
        self.assertEqual(len(fixed), 2)

    def test_restores_timing_from_original(self):
        orig = [self._seg(0.0, 1.5, "hello")]
        # Translated has wrong timing
        translated = [self._seg(9.0, 99.0, "hola")]
        fixed, _ = main._validate_and_fix_segments(translated, orig)
        self.assertEqual(fixed[0]["start"], 0.0)
        self.assertEqual(fixed[0]["end"], 1.5)

    def test_handles_empty_original(self):
        fixed, ok = main._validate_and_fix_segments([], [])
        self.assertEqual(fixed, [])
        self.assertTrue(ok)

    def test_count_mismatch_still_returns_fixed(self):
        orig = [self._seg(0, 1, "a"), self._seg(1, 2, "b")]
        translated = [self._seg(0, 1, "x")]  # only 1 segment
        fixed, ok = main._validate_and_fix_segments(translated, orig)
        self.assertFalse(ok)
        self.assertEqual(len(fixed), 1)

    def test_preserves_translated_text(self):
        orig = [self._seg(0, 2, "hello world")]
        translated = [self._seg(0, 2, "Hallo Welt")]
        fixed, _ = main._validate_and_fix_segments(translated, orig)
        self.assertEqual(fixed[0]["text"], "Hallo Welt")


class TestGetUserFriendlyError(unittest.TestCase):
    def _call(self, stage, message):
        return main.get_user_friendly_error(stage, message)

    def test_connection_reset(self):
        msg = self._call("DOWNLOADING", "connection reset by peer")
        self.assertIn("connection", msg.lower())

    def test_timeout(self):
        msg = self._call("TRANSCRIBING", "request timed out after 30s")
        self.assertIn("long", msg.lower())

    def test_out_of_memory(self):
        msg = self._call("TRANSCRIBING", "out of memory (OOM killed)")
        self.assertIn("memory", msg.lower())

    def test_whisper_error(self):
        msg = self._call("TRANSCRIBING", "whisper model failed to load")
        self.assertIn("transcription", msg.lower())

    def test_gemini_error(self):
        msg = self._call("TRANSLATING", "gemini api error 429")
        self.assertIn("translation", msg.lower())

    def test_storage_error(self):
        msg = self._call("DOWNLOADING", "minio bucket not found")
        self.assertIn("storage", msg.lower())

    def test_network_error(self):
        msg = self._call("DOWNLOADING", "network connection failed")
        self.assertIn("network", msg.lower())

    def test_unsupported_format(self):
        msg = self._call("INIT", "unsupported format: .xyz")
        self.assertIn("format", msg.lower())

    def test_empty_file(self):
        msg = self._call("DOWNLOADING", "file is empty")
        self.assertIn("empty", msg.lower())

    def test_unknown_returns_default(self):
        msg = self._call("UNKNOWN", "some totally unrecognised error 12345")
        self.assertIn("something went wrong", msg.lower())


if __name__ == '__main__':
    unittest.main()
