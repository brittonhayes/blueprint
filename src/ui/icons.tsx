/* Small, consistent line icons for the dock. Stroke inherits currentColor. */

type IconProps = { size?: number }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const PenIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 20l4-1L20 7a2 2 0 0 0-3-3L5 16l-1 4z" />
    <path d="M14 6l3 3" />
  </svg>
)

export const EraserIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 15l7-7 6 6-4 4H8l-4-4z" />
    <path d="M9 20h11" />
  </svg>
)

export const TextIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M5 6h14" />
    <path d="M12 6v13" />
    <path d="M9 19h6" />
  </svg>
)

export const DiagramIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 8h16" />
    <path d="M4 5v6M20 5v6" />
    <path d="M5 16h9" />
    <path d="M17 14l3 2-3 2" />
  </svg>
)

export const UndoIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M9 7L4 12l5 5" />
    <path d="M4 12h11a5 5 0 0 1 0 10h-1" />
  </svg>
)

export const TrashIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 7h16" />
    <path d="M9 7V5h6v2" />
    <path d="M6 7l1 13h10l1-13" />
  </svg>
)

export const GlowIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
  </svg>
)

export const ExportIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 15V4" />
    <path d="M8 8l4-4 4 4" />
    <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
  </svg>
)

export const DimensionIcon = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 12h18" />
    <path d="M3 8v8M21 8v8" />
  </svg>
)

export const LeaderIcon = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 6h8" />
    <path d="M11 6l9 12" />
    <path d="M16 18h5v-5" />
  </svg>
)

export const ListIcon = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
)
