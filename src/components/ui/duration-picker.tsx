import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type RefObject,
} from "react";
import { interpolate } from "flubber";
import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "motion/react";

import {
  SEAM_OVERLAP,
  SEGMENT_FOCUS_RING,
  SEGMENT_RADIUS,
  SquircleSegment,
} from "@/components/ui/squircle-segment";
import { cn } from "@/lib/utils";

/**
 * Adapted from rare-ui's `duration-picker`. The animation is unchanged; the
 * hard-coded greys became theme tokens, the fields gained labels and focus
 * rings, and `maxMinutes` now defaults to a real clock minute.
 *
 * The upstream controlled `value` prop was dropped. It re-synced the typed text
 * from the prop inside an effect, which fights any parent that clamps what it
 * stores: clearing a field commits 0, the clamp bounces it back, and the field
 * refills itself mid-edit. The picker owns its text; read it from `onChange`.
 */

const PEN_PATH =
  "M3.78181 16.3092L3 21L7.69086 20.2182C8.50544 20.0825 9.25725 19.6956 9.84119 19.1116L20.4198 8.53288C21.1934 7.75922 21.1934 6.5049 20.4197 5.73126L18.2687 3.58024C17.495 2.80658 16.2406 2.80659 15.4669 3.58027L4.88841 14.159C4.30447 14.7429 3.91757 15.4947 3.78181 16.3092Z";
const TICK_PATH =
  "M7.959 20.513L1.592 12.872L3.128 11.592L8.041 17.487L20.947 3.587L22.413 4.948L7.959 20.513Z";

const OPEN_GAP = 8;
const GAP_SPRING = { stiffness: 200, damping: 28, mass: 1 };
const ICON_SPRING = { stiffness: 200, damping: 28 };
const WIDTH_SPRING = { stiffness: 250, damping: 31 };
const SWAY_SPRING = { stiffness: 200, damping: 24 };
const ERROR_SPRING = { stiffness: 700, damping: 9 };

export interface DurationValue {
  hours: number;
  minutes: number;
}

export type DurationPickerProps = Omit<
  ComponentProps<"div">,
  | "onChange"
  | "defaultValue"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
> & {
  defaultValue?: DurationValue;
  onChange?: (value: DurationValue) => void;
  onConfirm?: (value: DurationValue) => void;
  onEditingChange?: (editing: boolean) => void;
  defaultEditing?: boolean;
  maxHours?: number;
  maxMinutes?: number;
  hoursLabel?: string;
  minutesLabel?: string;
  hoursAriaLabel?: string;
  minutesAriaLabel?: string;
  disabled?: boolean;
};

interface DurationFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  max: number;
  isEditing: boolean;
  shouldReduceMotion: boolean;
  disabled?: boolean;
  swayX: MotionValue<number>;
  label: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

function DurationField({
  value,
  onValueChange,
  max,
  isEditing,
  shouldReduceMotion,
  disabled,
  swayX,
  label,
  inputRef,
}: DurationFieldProps) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [textWidth, setTextWidth] = useState(0);
  const errorX = useSpring(0, ERROR_SPRING);
  const x = useTransform(() => swayX.get() + errorX.get());

  // The collapsed field is only as wide as its digits, so it has to be measured
  // off a hidden copy rendered in the same font.
  useLayoutEffect(() => {
    if (measureRef.current) {
      setTextWidth(measureRef.current.offsetWidth);
    }
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (next !== "" && (Number(next) > max || Number(next) < 0)) {
      onValueChange(String(Math.min(max, Math.max(0, Number(next)))));
      if (!shouldReduceMotion) {
        errorX.jump(6);
        errorX.set(0);
      }
      return;
    }
    onValueChange(next);
  };

  const collapsedWidth = Math.max(textWidth + 12, 22);

  return (
    <>
      <motion.input
        data-slot="duration-picker-input"
        ref={inputRef}
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={handleChange}
        placeholder={isEditing ? "" : "0"}
        readOnly={!isEditing}
        disabled={disabled}
        style={{ x, width: isEditing ? 44 : collapsedWidth }}
        animate={{ width: isEditing ? 44 : collapsedWidth }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { type: "spring", ...WIDTH_SPRING }
        }
        className={cn(
          "h-full text-center font-semibold text-foreground outline-none",
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          SEGMENT_FOCUS_RING,
        )}
      />
      <span
        ref={measureRef}
        aria-hidden="true"
        className="invisible absolute whitespace-pre font-semibold"
      >
        {value || "0"}
      </span>
    </>
  );
}

const clampField = (raw: number, max: number) =>
  Math.min(max, Math.max(0, Math.trunc(raw) || 0));

function fieldText(value: DurationValue | undefined, field: keyof DurationValue) {
  const n = value?.[field];
  return n === undefined || n === 0 ? "" : String(n);
}

function DurationPicker({
  defaultValue,
  onChange,
  onConfirm,
  onEditingChange,
  defaultEditing = false,
  maxHours = 24,
  maxMinutes = 59,
  hoursLabel = "Hr.",
  minutesLabel = "Min.",
  hoursAriaLabel = "Hours",
  minutesAriaLabel = "Minutes",
  disabled = false,
  className,
  ...props
}: DurationPickerProps) {
  const [isEditing, setIsEditing] = useState(defaultEditing);
  const [hoursText, setHoursText] = useState(() =>
    fieldText(defaultValue, "hours"),
  );
  const [minutesText, setMinutesText] = useState(() =>
    fieldText(defaultValue, "minutes"),
  );

  const toValue = (hours: string, minutes: string): DurationValue => ({
    hours: clampField(Number(hours), maxHours),
    minutes: clampField(Number(minutes), maxMinutes),
  });

  const handleHoursChange = (text: string) => {
    setHoursText(text);
    onChange?.(toValue(text, minutesText));
  };

  const handleMinutesChange = (text: string) => {
    setMinutesText(text);
    onChange?.(toValue(hoursText, text));
  };

  const shouldReduceMotion = useReducedMotion();
  const gap = useSpring(defaultEditing ? OPEN_GAP : 0, GAP_SPRING);
  const openness = (v: number) => Math.min(OPEN_GAP, Math.max(0, v)) / OPEN_GAP;
  const segmentSpacing = useTransform(
    gap,
    (v) =>
      `${Math.min(OPEN_GAP, Math.max(0, v)) - SEAM_OVERLAP * (1 - openness(v))}px`,
  );
  const innerRadius = useTransform(gap, (v) => SEGMENT_RADIUS * openness(v));
  const innerPadRight = useTransform(gap, (v) => `${3 + 9 * openness(v)}px`);
  const innerPadLeft = useTransform(gap, (v) => `${9 * openness(v)}px`);
  // The segments lag behind the gap spring, which is what makes them sway apart.
  const gapVelocity = useVelocity(gap);
  const swayXRaw = useTransform(gapVelocity, [-70, 0, 70], [-3, 0, 3], {
    clamp: true,
  });
  const swayX = useSpring(swayXRaw, SWAY_SPRING);
  const iconProgress = useSpring(defaultEditing ? 1 : 0, ICON_SPRING);
  const iconPath = useTransform(iconProgress, [0, 1], [PEN_PATH, TICK_PATH], {
    clamp: true,
    mixer: (from, to) => interpolate(from, to, { maxSegmentLength: 1 }),
  });
  const iconStrokeWidth = useTransform(iconProgress, [0, 1], [0, 2.5], {
    clamp: true,
  });
  const iconStrokeOpacity = useTransform(iconProgress, [0, 1], [0, 1], {
    clamp: true,
  });
  const iconDashOpacity = useTransform(iconProgress, [0, 0.4], [1, 0], {
    clamp: true,
  });
  const hoursInputRef = useRef<HTMLInputElement>(null);

  const toggleEdit = () => {
    if (disabled) return;

    const next = !isEditing;
    const targetGap = next ? OPEN_GAP : 0;
    const targetIcon = next ? 1 : 0;
    if (shouldReduceMotion) {
      gap.jump(targetGap);
      iconProgress.jump(targetIcon);
    } else {
      gap.set(targetGap);
      iconProgress.set(targetIcon);
    }
    setIsEditing(next);
    onEditingChange?.(next);
    if (next) {
      hoursInputRef.current?.focus();
    } else {
      onConfirm?.(toValue(hoursText, minutesText));
    }
  };

  return (
    <motion.div
      data-slot="duration-picker"
      data-editing={isEditing || undefined}
      data-disabled={disabled || undefined}
      role="group"
      className={cn(
        "flex flex-row items-center justify-center",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      <SquircleSegment
        leftRadius={SEGMENT_RADIUS}
        rightRadius={innerRadius}
        style={{ paddingRight: innerPadRight }}
        className="flex h-12 items-center gap-1 bg-muted pl-2"
      >
        <DurationField
          value={hoursText}
          onValueChange={handleHoursChange}
          max={maxHours}
          isEditing={isEditing}
          shouldReduceMotion={Boolean(shouldReduceMotion)}
          disabled={disabled}
          swayX={swayX}
          label={hoursAriaLabel}
          inputRef={hoursInputRef}
        />
        <motion.span
          style={{ x: swayX }}
          aria-hidden="true"
          className="font-semibold text-muted-foreground"
        >
          {hoursLabel}
        </motion.span>
      </SquircleSegment>

      <SquircleSegment
        leftRadius={innerRadius}
        rightRadius={innerRadius}
        style={{
          marginLeft: segmentSpacing,
          paddingLeft: innerPadLeft,
          paddingRight: innerPadRight,
        }}
        className="flex h-12 items-center gap-1 bg-muted"
      >
        <DurationField
          value={minutesText}
          onValueChange={handleMinutesChange}
          max={maxMinutes}
          isEditing={isEditing}
          shouldReduceMotion={Boolean(shouldReduceMotion)}
          disabled={disabled}
          swayX={swayX}
          label={minutesAriaLabel}
        />
        <motion.span
          style={{ x: swayX }}
          aria-hidden="true"
          className="font-medium text-muted-foreground"
        >
          {minutesLabel}
        </motion.span>
      </SquircleSegment>

      <SquircleSegment
        asChild
        leftRadius={innerRadius}
        rightRadius={SEGMENT_RADIUS}
        style={{ marginLeft: segmentSpacing }}
      >
        <button
          data-slot="duration-picker-toggle"
          type="button"
          onClick={toggleEdit}
          disabled={disabled}
          aria-pressed={isEditing}
          aria-label={isEditing ? "Save duration" : "Edit duration"}
          className={cn(
            "flex h-12 w-12 items-center justify-center bg-muted text-muted-foreground",
            "transition-transform active:scale-90 disabled:active:scale-100",
            SEGMENT_FOCUS_RING,
          )}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <motion.path
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={0}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{
                strokeWidth: iconStrokeWidth,
                strokeOpacity: iconStrokeOpacity,
              }}
              d={iconPath}
            />
            {/* Cuts the nib off the pen by painting the segment's own colour over it. */}
            <motion.path
              d="M14 6L18 10"
              fill="none"
              strokeWidth={1.5}
              strokeLinecap="round"
              className="stroke-muted"
              style={{ opacity: iconDashOpacity }}
            />
          </svg>
        </button>
      </SquircleSegment>
    </motion.div>
  );
}

export { DurationPicker };
