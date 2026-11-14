import unittest
from monitor import parse_memory, LIMIT


class MemoryDisplayTests(unittest.TestCase):
    def test_binary_units_do_not_get_mistaken_for_decimal_mb(self):
        self.assertEqual(parse_memory("44M")["estimateBytes"], 44*1024*1024)

    def test_uncertainty_near_the_limit_cannot_pass(self):
        r = parse_memory("47M")
        self.assertLess(r["estimateBytes"], LIMIT)
        self.assertGreater(r["conservativeUpperBytes"], LIMIT)

    def test_observed_above_limit_is_not_hidden_by_rounding(self):
        self.assertGreater(parse_memory("50M")["conservativeLowerBytes"], LIMIT)

    def test_direction_markers_are_not_extra_memory(self):
        self.assertEqual(parse_memory("44M+")["estimateBytes"], parse_memory("44M-")["estimateBytes"])

    def test_decimal_display_retains_its_precision(self):
        self.assertEqual(parse_memory("1.5G")["conservativeUpperBytes"], int(1.6*1024**3))

    def test_unavailable_counters_never_become_zero_usage(self):
        for value in ["N/A", "", "-1M", "44MB", "NaN", "?", "44M SECRET"]:
            with self.assertRaises(ValueError):
                parse_memory(value)


if __name__ == "__main__":
    unittest.main()
