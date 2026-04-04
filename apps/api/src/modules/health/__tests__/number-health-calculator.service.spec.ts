import { describe, it, expect, beforeEach } from 'vitest';
import { NumberHealthCalculatorService } from '../number-health-calculator.service';

describe('NumberHealthCalculatorService', () => {
  let service: NumberHealthCalculatorService;

  beforeEach(() => {
    service = new NumberHealthCalculatorService();
  });

  describe('calculate', () => {
    it('should return 100 for perfect metrics', () => {
      const score = service.calculate({
        responseRate: 1.0,
        readRate: 1.0,
        bounceRate: 0.0,
        instanceAgeDays: 365,
        volumeRatio: 1.0,
      });

      expect(score).toBe(100);
    });

    it('should return low score for bad metrics', () => {
      const score = service.calculate({
        responseRate: 0.1,
        readRate: 0.1,
        bounceRate: 0.9,
        instanceAgeDays: 1,
        volumeRatio: 10.0,
      });

      expect(score).toBeLessThan(30);
    });

    it('should weight response rate at 30%', () => {
      const baseScore = service.calculate({
        responseRate: 0.5,
        readRate: 1.0,
        bounceRate: 0.0,
        instanceAgeDays: 365,
        volumeRatio: 1.0,
      });

      const fullResponseScore = service.calculate({
        responseRate: 1.0,
        readRate: 1.0,
        bounceRate: 0.0,
        instanceAgeDays: 365,
        volumeRatio: 1.0,
      });

      // Difference should be ~15 points (30% * 50% difference)
      const diff = fullResponseScore - baseScore;
      expect(diff).toBeCloseTo(15, 0);
    });

    it('should clamp score between 0 and 100', () => {
      const score = service.calculate({
        responseRate: 0,
        readRate: 0,
        bounceRate: 1.0,
        instanceAgeDays: 0,
        volumeRatio: 100,
      });

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('getThrottleAction', () => {
    it('should return normal for score > 80', () => {
      expect(service.getThrottleAction(85)).toBe('normal');
    });

    it('should return light throttle for score 60-80', () => {
      expect(service.getThrottleAction(70)).toBe('light_throttle');
    });

    it('should return heavy throttle for score 40-60', () => {
      expect(service.getThrottleAction(50)).toBe('heavy_throttle');
    });

    it('should return pause for score < 40', () => {
      expect(service.getThrottleAction(30)).toBe('pause_proactive');
    });
  });
});
