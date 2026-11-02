import type { ButtonHTMLAttributes } from 'react';

/** 공통 버튼 (FE2) */
export default function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' },
) {
  const { variant = 'primary', ...rest } = props;
  return <button data-variant={variant} {...rest} />;
}
