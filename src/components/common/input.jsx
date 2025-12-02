import React, { useState, useMemo } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import ThemeAssets from "../../assets/themeAssets";

/**
 * Custom Input component with support for text, password, and date types
 * @param {string} type - Input type (text, password, date, etc.)
 * @param {string} className - CSS classes for the input wrapper
 * @param {string} inputClass - CSS classes for the input element
 * @param {string} mainWrapper - CSS classes for the main wrapper div
 * @param {string} label - Label text for the input
 * @param {string} labelClass - CSS classes for the label
 * @param {function} onChange - Callback when input value changes
 * @param {string} name - Input name attribute
 * @param {string} id - Input id attribute
 * @param {any} value - Input value
 * @param {string} placeholder - Placeholder text
 * @param {string} icon - Icon to display (typically for password toggle)
 * @param {number} maxLength - Maximum character length
 * @param {boolean} error - Error state flag
 * @param {string} errorMessage - Error message to display
 * @param {boolean} disabled - Disabled state
 * @param {boolean} required - Required field flag
 * @param {number} startDate - Minimum date offset for date picker
 * @param {string} iconStart - Icon to display at the start of the input
 */
const Input = ({
  type = "text",
  className,
  inputClass,
  mainWrapper,
  label,
  labelClass,
  onChange,
  name,
  id,
  value,
  placeholder = "Enter here",
  icon,
  maxLength,
  error,
  errorMessage,
  disabled = false,
  required = false,
  startDate = 1,
  iconStart,
}) => {
  // State to toggle password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Boolean flags for conditional rendering and logic
  const isPasswordType = type === "password";
  const isDateType = type === "date";

  // Determine input type (toggle between text/password for password fields)
  const inputType = isPasswordType
    ? showPassword
      ? "text"
      : "password"
    : type;

  // Determine which icon to show (eye icons for password, custom icon otherwise)
  const inputIcon = isPasswordType
    ? showPassword
      ? ThemeAssets.eyeOpen
      : ThemeAssets.eyeClose
    : icon;

  // Memoized function to disable past dates in date picker
  // Only recreates when startDate changes
  const disablePastDates = useMemo(
    () => (current) =>
      current && current < dayjs().add(startDate, "day").startOf("day"),
    [startDate]
  );

  // Combined CSS classes for the input wrapper
  // Includes hover, focus, error, and disabled states
  const wrapperClasses = `relative flex items-center gap-3 rounded-md px-3 py-2.5 overflow-hidden outline hover:outline-[#308748] focus-within:outline focus-within:outline-[#308748] ${
    errorMessage ? "outline-crimson bg-crimson/10" : "outline-input-outline"
  } ${disabled ? "bg-[#e9e9e9]" : ""} ${className}`;

  // Combined CSS classes for the input element
  // Includes typography, placeholder, error, and disabled states
  const inputClasses = `w-full h-full bg-transparent border-none outline-none text-black text-sm font-light font-inter 
  placeholder:font-light placeholder:text-[#e9e9e9] ${
    disabled && "text-[#888888]"
  } ${icon ? "pr-6" : ""} ${
    errorMessage ? "text-crimson placeholder:text-crimson" : ""
  } ${inputClass}`;

  return (
    <div className={`flex flex-col gap-2 ${mainWrapper}`}>
      {/* Render label with optional required indicator */}
      {label && (
        <label className={`text-sm capitalize font-inter ${labelClass}`}>
          {label}
          {required && <span className="text-crimson"> *</span>}
        </label>
      )}

      <div className={wrapperClasses}>
        {/* Start icon (displayed before input) */}
        {iconStart && <img src={iconStart} alt="icon" className="size-5" />}

        {/* Conditional rendering: DatePicker for date type, regular input for others */}
        {isDateType ? (
          <DatePicker
            onChange={onChange}
            className={`!p-0 focus:shadow-none focus:outline-none focus-within:outline-none focus-within:shadow-none w-full h-full ${inputClass}`}
            disabledDate={disablePastDates}
            rootClassName="!border-none !shadow-none !outline-none [&_input]:!leading-[0] [&_.ant-picker-input]:!shadow-none [&_.ant-picker-input]:!outline-none"
            classNames={{
              popup: {
                root: "date-picker-popup [&_.ant-picker-cell-today_.ant-picker-cell-inner::before]:border-[red] [&_.ant-picker-cell-selected_.ant-picker-cell-inner]:bg-[#308748]",
              },
            }}
            format="DD/MM/YYYY"
          />
        ) : (
          <input
            autoComplete="off"
            type={inputType}
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            className={inputClasses}
            disabled={disabled}
            maxLength={maxLength}
            placeholder={placeholder}
          />
        )}

        {/* End icon (typically for password toggle or decorative icon) */}
        {icon && (
          <img
            src={inputIcon}
            alt="icon"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 cursor-pointer"
            onClick={() => isPasswordType && setShowPassword(!showPassword)}
          />
        )}
      </div>

      {/* Display error message if present */}
      {errorMessage && <p className="text-sm text-crimson">{errorMessage}</p>}
    </div>
  );
};

export default Input;
