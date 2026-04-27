"use client";

import { cn } from "@/lib/utils";
import {
  forwardRef,
  ButtonHTMLAttributes,
  isValidElement,
  cloneElement,
  ReactElement,
} from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      asChild,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
      primary:
        "bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-110 focus:ring-[var(--ring)] rounded-full shadow-sm hover:shadow-md",
      secondary:
        "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--secondary)]/80 focus:ring-[var(--ring)] rounded-full",
      outline:
        "border border-[var(--border)] bg-transparent hover:bg-[var(--accent)] focus:ring-[var(--ring)] rounded-full",
      ghost:
        "bg-transparent hover:bg-[var(--accent)] focus:ring-[var(--ring)] rounded-lg",
      destructive:
        "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive)]/90 focus:ring-[var(--destructive)] rounded-full",
    };

    const sizes = {
      sm: "h-8 px-4 text-sm",
      md: "h-10 px-5 text-sm",
      lg: "h-12 px-8 text-base font-semibold",
      icon: "h-10 w-10 p-0",
    };

    const combinedClassName = cn(
      baseStyles,
      variants[variant],
      sizes[size],
      className
    );

    if (asChild && isValidElement(children)) {
      return cloneElement(children as ReactElement<Record<string, unknown>>, {
        className: cn(
          combinedClassName,
          (children as ReactElement<Record<string, unknown>>).props
            .className as string
        ),
        ref,
      });
    }

    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
