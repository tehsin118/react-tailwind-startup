import React, { useMemo } from "react";
import { Select } from "antd";

/**
 * Skeleton loader component for Select
 * @param {number} height - Height of the skeleton
 * @param {string|number} width - Width of the skeleton
 */

/**
 * Custom Select component wrapper for Ant Design Select
 * @param {string} wrapperClasses - CSS classes for the wrapper div
 * @param {string} className - CSS classes for the Select component
 * @param {any} value - Selected value(s)
 * @param {function} onChange - Callback when selection changes
 * @param {Array} options - Array of options with {value, label, key?}
 * @param {string} label - Label text for the select
 * @param {string} labelClass - CSS classes for the label
 * @param {boolean} error - Error state flag
 * @param {string} placeholder - Placeholder text
 * @param {boolean} showSearch - Enable search functionality
 * @param {string} mode - Select mode (multiple, tags, etc.)
 * @param {string} errorMessage - Error message to display
 */
const CustomSelect = ({
  wrapperClasses,
  className,
  value,
  onChange,
  options,
  label,
  labelClass,
  error,
  placeholder = "Select",
  showSearch,
  mode,
  errorMessage,
}) => {
  // Remove accent/diacritics from text for better search comparison
  const removeAccents = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  // Memoized filter function for search functionality
  // Only created when showSearch is enabled to optimize performance
  const filterOption = useMemo(
    () =>
      showSearch
        ? (input, option) => {
            const normalizedInput = removeAccents(input).toLowerCase();
            const normalizedLabel = removeAccents(
              option?.label || ""
            ).toLowerCase();
            return normalizedLabel.includes(normalizedInput);
          }
        : undefined,
    [showSearch]
  );

  // Memoized mapped options to prevent recreation on every render
  // Ensures each option has a unique key
  const mappedOptions = useMemo(
    () =>
      options?.map((option, index) => ({
        key: option.key || `${option.value}-${index}`,
        value: option.value,
        label: option.label,
      })),
    [options]
  );

  // Combined CSS classes for the Select component
  // Includes hover, focus, and typography styles
  const selectClasses = `${className} [&_.ant-select-selector]:hover:!border-red-400 [&_.ant-select-selector]:focus:!border-red-400 [&_.ant-select-selector]:focus-within:!border-red-400 [&_.ant-select-selection-placeholder]:text-sm [&_.ant-select-selection-item]:text-sm`;

  return (
    <div
      className={`select-wrapper flex flex-col gap-2 ${wrapperClasses} ${
        error ? "error" : ""
      }`}
    >
      {/* Render label if provided */}
      {label && (
        <label className={`block text-sm capitalize ${labelClass}`}>
          {label}
        </label>
      )}

      {/* Ant Design Select component */}
      <Select
        onChange={onChange}
        options={mappedOptions}
        showSearch={showSearch}
        value={value}
        className={selectClasses}
        classNames={{ popup: { root: "custom-select-dropdown" } }}
        placeholder={placeholder}
        mode={mode}
        filterOption={filterOption}
        notFoundContent={<p></p>}
      />

      {/* Display error message if present */}
      {errorMessage && <p className="text-sm text-crimson">{errorMessage}</p>}
    </div>
  );
};

export default CustomSelect;
