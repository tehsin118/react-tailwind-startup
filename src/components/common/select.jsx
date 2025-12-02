import React from "react";
import { Select } from "antd";

const SelectSkeleton = ({ height = 40, width = "100%" }) => {
  return (
    <div className="select-wrapper">
      <div
        className="animate-pulse bg-gray-300 rounded"
        style={{
          height: height,
          width: width,
          minWidth: typeof width === "string" ? width : `${width}px`,
        }}
      />
    </div>
  );
};

const CustomSelect = ({
  wrapperClasses,
  className,
  value = "as",
  onChange,
  options,
  label,
  labelClass,
  error,
  placeholder = "Select",
  showSearch,
  mode,
  errorMessage,
  loading,
}) => {
  // Function to remove accents/diacritics for search comparison
  const removeAccents = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  // Show skeleton when loading
  if (loading) {
    return (
      <div
        className={`select-wrapper ${wrapperClasses} ${error ? "error" : ""}`}
      >
        {label && (
          <label className={`${labelClass} ${value ? "active" : ""} min-w-fit`}>
            {label}
          </label>
        )}
        <SelectSkeleton height={height} width={width || minWidth} />
      </div>
    );
  }

  const filterOption = (input, option) => {
    const normalizedInput = removeAccents(input).toLowerCase();
    const normalizedLabel = removeAccents(option?.label || "").toLowerCase();
    return normalizedLabel.includes(normalizedInput);
  };

  const baseStyle = ``;
  const typoStyle = `[&_.ant-select-selection-placeholder]:text-sm [&_.ant-select-selection-item]:text-sm [&_.ant-select-selection-item]:leading-`;
  const focusStyle = `[&_.ant-select-selector]:focus:!border-red-400 [&_.ant-select-selector]:focus-within:!border-red-400`;
  const hoverStyle = `[&_.ant-select-selector]:hover:!border-red-400`;
  return (
    <>
      <div
        className={`select-wrapper flex flex-col gap-2 ${wrapperClasses}  ${
          error ? "error" : ""
        } `}
      >
        {label && (
          <label className={`block text-sm capitalize ${labelClass}   `}>
            {label}
          </label>
        )}
        <Select
          onChange={onChange}
          options={options?.map((option, index) => ({
            key: option.key || `${option.value}-${index}`,
            value: option.value,
            label: option.label,
          }))}
          showSearch={showSearch}
          value={value}
          className={`${className} ${focusStyle} ${baseStyle} ${typoStyle} ${hoverStyle} `}
          classNames={{ popup: { root: "custom-select-dropdown " } }}
          placeholder={placeholder}
          mode={mode}
          filterOption={showSearch ? filterOption : undefined}
          notFoundContent={<p></p>}
        />
        {errorMessage && (
          <p className="extra-small text-xs font-medium text-red-600">
            {errorMessage}
          </p>
        )}
      </div>
    </>
  );
};

export default CustomSelect;
