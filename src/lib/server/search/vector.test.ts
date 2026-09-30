import { describe, expect, it } from 'vitest';
import { TtlLruCache, vectorQueryText } from './vector';

describe('vectorQueryText', () => {
    it('mirrors the document shape: title\\nauthor', () => {
        expect(vectorQueryText(' Sahih Bukhari ', ' Imam Bukhari ')).toBe('Sahih Bukhari\nImam Bukhari');
    });

    it('uses whichever part is present', () => {
        expect(vectorQueryText('Sahih Bukhari', '')).toBe('Sahih Bukhari');
        expect(vectorQueryText('', 'Imam Bukhari')).toBe('Imam Bukhari');
        expect(vectorQueryText('', '  ')).toBe('');
    });
});

describe('TtlLruCache', () => {
    it('evicts the least recently used entry beyond the max', () => {
        const c = new TtlLruCache<number>(2, 1000);
        c.set('a', 1);
        c.set('b', 2);
        expect(c.get('a')).toBe(1); // refresh a
        c.set('c', 3); // evicts b
        expect(c.get('b')).toBeUndefined();
        expect(c.get('a')).toBe(1);
        expect(c.get('c')).toBe(3);
        expect(c.size).toBe(2);
    });

    it('expires entries after the TTL', () => {
        let now = 0;
        const c = new TtlLruCache<number>(10, 1000, () => now);
        c.set('a', 1);
        now = 1000;
        expect(c.get('a')).toBe(1);
        now = 1001;
        expect(c.get('a')).toBeUndefined();
        expect(c.size).toBe(0);
    });

    it('overwriting a key resets its age', () => {
        let now = 0;
        const c = new TtlLruCache<number>(10, 1000, () => now);
        c.set('a', 1);
        now = 900;
        c.set('a', 2);
        now = 1500;
        expect(c.get('a')).toBe(2);
    });
});
