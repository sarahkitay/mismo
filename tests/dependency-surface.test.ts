import { describe, expect, it } from 'vitest';
import pkg from '../package.json';

const KEEP = [
  '@radix-ui/react-collapsible',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-label',
  '@radix-ui/react-select',
  '@radix-ui/react-slot',
  '@radix-ui/react-switch',
  '@radix-ui/react-tabs',
];

describe('dependency surface', () => {
  it('does not ship the unused Radix shadcn catalog', () => {
    const deps = Object.keys(pkg.dependencies);
    const radix = deps.filter((d) => d.startsWith('@radix-ui/'));
    expect(radix.sort()).toEqual([...KEEP].sort());
    expect(deps).not.toContain('embla-carousel-react');
    expect(deps).not.toContain('input-otp');
    expect(deps).not.toContain('vaul');
    expect(deps).not.toContain('cmdk');
    expect(deps).not.toContain('react-day-picker');
    expect(deps).not.toContain('@gsap/react');
    expect(deps).not.toContain('next-themes');
  });
});
