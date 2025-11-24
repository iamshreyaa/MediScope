#!/usr/bin/env python3
"""
Test script to verify Gemini API integration is working correctly.
"""
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Activate venv and test
try:
    from backend.gemini_client import chat_with_gemini
    
    def test_gemini():
        """Test the Gemini API client."""
        print("=" * 60)
        print("Testing Gemini API Client")
        print("=" * 60)
        
        # Test 1: Simple query
        print("\n[Test 1] Simple query...")
        try:
            test_message = "Hello, can you tell me what 2+2 equals?"
            print(f"Query: {test_message}")
            response = chat_with_gemini("test_patient_123", test_message)
            print(f"Response: {response}")
            print("✓ Test 1 passed!")
        except Exception as e:
            print(f"✗ Test 1 failed: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        print("\n" + "=" * 60)
        print("Test passed! ✓")
        print("=" * 60)
        return True
    
    if __name__ == "__main__":
        success = test_gemini()
        sys.exit(0 if success else 1)
        
except ImportError as e:
    print(f"Import error: {e}")
    print("Make sure you're running from the project root with venv activated")
    sys.exit(1)
