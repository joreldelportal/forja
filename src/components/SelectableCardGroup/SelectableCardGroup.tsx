import styles from "./SelectableCardGroup.module.css";

export interface CardOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

interface SelectableCardGroupProps<T extends string> {
  options: CardOption<T>[];
  value: T | null;  // Permite null para estado inicial sin selección
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4 | 5;
  disabled?: boolean;
  size?: "default" | "compact";
}

export default function SelectableCardGroup<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
  disabled = false,
  size = "default",
}: SelectableCardGroupProps<T>) {
  const gridClass = {
    2: styles.grid2,
    3: styles.grid3,
    4: styles.grid4,
    5: styles.grid5,
  }[columns];

  const sizeClass = size === "compact" ? styles.compact : "";

  return (
    <div className={`${styles.cardGroup} ${gridClass} ${sizeClass}`}>
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`${styles.card} ${isSelected ? styles.selected : ""}`}
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            aria-pressed={isSelected}
          >
            {option.icon && <span className={styles.icon}>{option.icon}</span>}
            <span className={styles.label}>{option.label}</span>
            {isSelected && <span className={styles.checkmark}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}
