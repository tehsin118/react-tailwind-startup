import React from "react";
import { Checkbox as AntCheckbox } from "antd";

/**
 * Custom Checkbox component wrapper for Ant Design Checkbox
 * @param {string} className - CSS classes for the checkbox
 * @param {string} label - Label text for the checkbox
 * @param {string} labelClass - CSS classes for the label
 * @param {boolean} checked - Checked state
 * @param {boolean} disabled - Disabled state
 * @param {function} onChange - Callback when checkbox state changes
 * @param {any} value - Checkbox value
 * @param {React.ReactNode} children - Child elements (alternative to label)
 * @param {string} checkedColor - Custom color for checked state (default: #308748)
 */
const Checkbox = ({
  className,
  label,
  labelClass,
  checked,
  disabled = false,
  onChange,
  value,
  children,
  checkedColor = "#308748",
}) => {
  // Combined CSS classes for the checkbox
  // Includes custom checked color with !important to override Ant Design defaults
  const checkboxClasses = `[&_.ant-checkbox-checked_.ant-checkbox-inner]:!bg-[${checkedColor}] [&_.ant-checkbox-checked_.ant-checkbox-inner]:!border-[${checkedColor}] ${className}`;

  return (
    <AntCheckbox
      className={checkboxClasses}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      value={value}
    >
      {/* Render children if provided, otherwise render label */}
      {children ||
        (label && <span className={`text-sm ${labelClass}`}>{label}</span>)}
    </AntCheckbox>
  );
};

export default Checkbox;
