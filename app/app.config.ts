export default defineAppConfig({
  ui: {
    colors: {
      primary: 'hazard',
      neutral: 'site',
    },
    button: {
      slots: {
        base: [
          'rounded-[6px] font-semibold inline-flex items-center justify-center whitespace-nowrap',
          'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:opacity-55',
          'transition-[background-color,box-shadow,color,transform] duration-150',
          'active:not-disabled:scale-[0.97]',
          'focus-visible:outline-2 focus-visible:outline-hazard focus-visible:outline-offset-2',
        ],
      },
      variants: {
        size: {
          sm: {
            base: 'h-7 px-2.5 text-xs gap-1.5',
            leadingIcon: 'size-3.5',
            trailingIcon: 'size-3.5',
          },
          md: {
            base: 'h-8 px-[13.6px] text-[13px] leading-none gap-1.5',
            leadingIcon: 'size-4',
            trailingIcon: 'size-4',
          },
          lg: {
            base: 'h-10 px-5 text-[15px] leading-none gap-2',
            leadingIcon: 'size-4',
            trailingIcon: 'size-4',
          },
          xl: {
            base: 'h-11 px-5 text-[15px] leading-none gap-2',
            leadingIcon: 'size-5',
            trailingIcon: 'size-5',
          },
        },
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'solid',
          class: 'bg-hazard text-ink hover:bg-hazard-hover active:bg-hazard-hover shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)] disabled:bg-hazard aria-disabled:bg-hazard',
        },
        {
          color: 'neutral',
          variant: 'outline',
          class: 'bg-transparent text-ink ring-1 ring-inset ring-line hover:bg-card hover:ring-line-strong active:bg-card disabled:bg-transparent disabled:hover:bg-transparent disabled:ring-line',
        },
        {
          color: 'neutral',
          variant: 'ghost',
          class: 'bg-transparent text-ink hover:bg-hover-tint active:bg-hover-tint disabled:bg-transparent',
        },
        {
          color: 'error',
          variant: 'ghost',
          class: 'bg-transparent text-danger hover:bg-hover-tint active:bg-hover-tint disabled:bg-transparent',
        },
      ],
      defaultVariants: {
        color: 'primary',
        variant: 'solid',
        size: 'md',
      },
    },
    input: {
      slots: {
        root: 'relative flex items-center w-full',
        base: [
          'w-full rounded-[6px] bg-card text-ink border border-line ring-0',
          'placeholder:text-placeholder placeholder:opacity-100',
          'focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgb(242_194_0/0.45)] focus:ring-0',
          'disabled:cursor-not-allowed disabled:opacity-55',
          'transition-[border-color,box-shadow,background-color] duration-150',
        ],
      },
      variants: {
        size: {
          md: {
            base: 'h-[33.6px] px-[10.4px] py-0 text-sm',
          },
          lg: {
            base: 'h-10 px-3 py-0 text-[15px]',
          },
        },
        variant: {
          outline: 'bg-card text-ink ring-0 border border-line',
        },
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'outline',
          class: 'focus-visible:ring-0 focus-visible:border-ink focus-visible:shadow-[0_0_0_3px_rgb(242_194_0/0.45)]',
        },
        {
          color: 'neutral',
          variant: 'outline',
          class: 'focus-visible:ring-0 focus-visible:border-ink focus-visible:shadow-[0_0_0_3px_rgb(242_194_0/0.45)]',
        },
      ],
      defaultVariants: {
        color: 'neutral',
        variant: 'outline',
        size: 'md',
      },
    },
    select: {
      slots: {
        base: [
          'w-full rounded-[6px] bg-card text-ink border border-line ring-0',
          'focus-visible:outline-none focus-visible:border-ink focus-visible:shadow-[0_0_0_3px_rgb(242_194_0/0.45)] focus-visible:ring-0',
          'transition-[border-color,box-shadow] duration-150',
        ],
        content: 'bg-panel text-ink rounded-[10px] shadow-[0_14px_40px_-8px_rgb(0_0_0/0.5),0_0_0_1px_rgb(0_0_0/0.06)] ring-0',
        item: 'text-ink text-[13px] data-highlighted:not-data-disabled:before:bg-hover-tint',
      },
      variants: {
        size: {
          md: {
            base: 'h-[33.6px] px-[10.4px] py-0 text-sm',
          },
        },
        variant: {
          outline: 'bg-card text-ink ring-0 border border-line',
        },
      },
      defaultVariants: {
        color: 'neutral',
        variant: 'outline',
        size: 'md',
      },
    },
    formField: {
      slots: {
        label: 'block font-cond font-bold text-[11px] leading-none tracking-[0.1em] uppercase text-muted mb-1.5',
        hint: 'text-xs text-muted',
        description: 'text-xs text-muted mt-1',
        help: 'mt-1.5 text-xs text-muted',
        error: 'text-xs text-error-ink mt-1 font-medium',
      },
    },
    card: {
      slots: {
        root: 'rounded-[10px] bg-card text-ink ring-1 ring-line shadow-none',
        header: 'p-4 sm:px-5 border-b border-line',
        body: 'p-4 sm:p-5',
        footer: 'p-4 sm:px-5 border-t border-line bg-paper',
      },
    },
    modal: {
      slots: {
        overlay: 'fixed inset-0',
        content: 'bg-panel text-ink rounded-[12px] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)] ring-0 divide-y-0',
        header: 'px-6 pt-6 pb-2 border-0 min-h-0 flex items-start justify-between',
        body: 'px-6 py-4',
        footer: 'flex items-center justify-end gap-2 px-6 py-4 border-t border-line bg-paper rounded-b-[12px]',
        title: 'font-cond font-bold text-2xl leading-none text-ink',
        description: 'mt-1 text-sm text-muted',
        close: 'top-4 end-4',
      },
      variants: {
        overlay: {
          true: {
            overlay: 'bg-ink/50 backdrop-blur-[2px]',
          },
        },
        fullscreen: {
          false: {
            content: 'w-[calc(100vw-2rem)] max-w-lg rounded-[12px] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)] ring-0',
          },
        },
      },
    },
    toast: {
      slots: {
        root: 'bg-ink text-card rounded-[10px] ring-0 px-3.5 py-2.5 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.5),inset_0_0_0_1px_rgb(242_194_0/0.35)]',
        title: 'text-[13px] font-medium text-card',
        description: 'text-xs text-card/80',
        close: 'text-card/75 hover:text-card hover:bg-white/10',
      },
    },
    contextMenu: {
      slots: {
        content: 'min-w-48 bg-panel text-ink rounded-[10px] p-1 shadow-[0_14px_40px_-8px_rgb(0_0_0/0.5),0_0_0_1px_rgb(0_0_0/0.06)] ring-0 divide-line',
        item: 'rounded-[6px] text-[13px] text-ink data-highlighted:not-data-disabled:before:bg-hover-tint',
        itemTrailingKbds: 'gap-0.5 text-muted',
        separator: 'bg-line my-1',
      },
    },
    dropdownMenu: {
      slots: {
        content: 'min-w-44 bg-panel text-ink rounded-[10px] p-1 shadow-[0_14px_40px_-8px_rgb(0_0_0/0.5),0_0_0_1px_rgb(0_0_0/0.06)] ring-0 divide-line',
        item: 'rounded-[6px] text-[13px] text-ink data-highlighted:not-data-disabled:before:bg-hover-tint',
        itemTrailingKbds: 'gap-0.5 text-muted',
        separator: 'bg-line my-1',
      },
    },
    kbd: {
      base: 'font-mono font-medium text-[11px] rounded-[3px] bg-black/[0.07] text-ink ring-0 shadow-[inset_0_-1px_0_rgb(0_0_0/0.15)]',
    },
  },
})
