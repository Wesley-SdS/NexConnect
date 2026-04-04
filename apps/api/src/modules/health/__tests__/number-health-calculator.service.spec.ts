import { describe, it, expect, beforeEach } from 'vitest';
import { NumberHealthCalculatorService } from '../number-health-calculator.service';

describe('NumberHealthCalculatorService', () => {
  let service: NumberHealthCalculatorService;

  beforeEach(() => {
    service = new NumberHealthCalculatorService(null as any, null as any);
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

      const diff = fullResponseScore - baseScore;
      expect(diff).toBeCloseTo(15, 0);
    });

    it('should weight read rate at 20%', () => {
      const baseScore = service.calculate({
        responseRate: 1.0,
        readRate: 0.5,
        bounceRate: 0.0,
        instanceAgeDays: 365,
        volumeRatio: 1.0,
      });

      const fullReadScore = service.calculate({
        responseRate: 1.0,
        readRate: 1.0,
        bounceRate: 0.0,
        instanceAgeDays: 365,
        volumeRatio: 1.0,
      });

      const diff = fullReadScore - baseScore;
      expect(diff).toBeCloseTo(10, 0);
    });

    it('should weight bounce rate at 20%', () => {
      const noBounce = service.calculate({
        responseRate: 1.0,
        readRate: 1.0,
        bounceRate: 0.0,
        instanceAgeDays: 365,
        volumeRatio: 1.0,
      });

      const halfBounce = service.calculate({
        responseRate: 1.0,
        readRate: 1.0,
        bounceRate: 0.5,
        instanceAgeDays: 365,
        volumeRatio: 1.0,
      });

      const diff = noBounce - halfBounce;
      expect(diff).toBeCloseTo(10, 0);
    });

    it('should weight instance age at 15%', () => {
      const newInstance = service.calculate({
        responseRate: 1.0,
        readRate: 1.0,
        bounceRate: 0.0,
        instanceAgeDays: 0,
        volumeRatio: 1.0,
      });

      const oldInstance = service.calculate({
        responseRate: 1.0,
        readRate: 1.0,
        bounceRate: 0.0,
        instanceAgeDays: 90,
        volumeRatio: 1.0,
      });

      const diff = oldInstance - newInstance;
      expect(diff).toBeCloseTo(15, 0);
    });

    it('should weight volume at 15%', () => {
      const normalVolume = service.calculate({
        responseRate: 1.0,
        readRate: 1.0,
        bounceRate: 0.0,
        instanceAgeDays: 365,
        volumeRatio: 1.0,
      });

      const highVolume = service.calculate({
        responseRate: 1.0,
        readRate: 1.0,
        bounceRate: 0.0,
        instanceAgeDays: 365,
        volumeRatio: 6.0,
      });

      const diff = normalVolume - highVolume;
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
      expect(service.getThrottleAction(100)).toBe('normal');
    });

    it('should return light_throttle for score 60-80', () => {
      expect(service.getThrottleAction(80)).toBe('light_throttle');
      expect(service.getThrottleAction(70)).toBe('light_throttle');
      expect(service.getThrottleAction(60)).toBe('light_throttle');
    });

    it('should return heavy_throttle for score 40-59', () => {
      expect(service.getThrottleAction(59)).toBe('heavy_throttle');
      expect(service.getThrottleAction(50)).toBe('heavy_throttle');
      expect(service.getThrottleAction(40)).toBe('heavy_throttle');
    });

    it('should return pause_proactive for score < 40', () => {
      expect(service.getThrottleAction(39)).toBe('pause_proactive');
      expect(service.getThrottleAction(0)).toBe('pause_proactive');
    });
  });

  describe('getDelayMultiplier', () => {
    it('should return 1.0 for normal', () => {
      expect(service.getDelayMultiplier(85)).toBe(1.0);
    });

    it('should return 1.2 for light_throttle (+20% delay)', () => {
      expect(service.getDelayMultiplier(70)).toBe(1.2);
    });

    it('should return 2.0 for heavy_throttle (-50% volume = 2x delay)', () => {
      expect(service.getDelayMultiplier(50)).toBe(2.0);
    });

    it('should return Infinity for pause_proactive', () => {
      expect(service.getDelayMultiplier(30)).toBe(Infinity);
    });
  });
});
