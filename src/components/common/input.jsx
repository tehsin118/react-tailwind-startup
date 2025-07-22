import React, { useState } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import ThemeAssets from "../../assets/themeAssets";

const Input = ({
  type = "text",
  wrapperClass,
  className,
  inputClass,
  label,
  labelClass,
  onChange,
  name,
  id,
  value,
  placeholder = "Enter here",
  icon,
  maxWidth,
  maxHeight,
  minHeight,
  minWidth,
  height,
  width,
  maxLength,
  error,
  errorMessage,
  disabled = false,
  required = false,
  startDate = 1,
  iconStart,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputStyle = {
    height,
    minHeight,
    maxHeight,
    width,
    minWidth,
    maxWidth,
  };

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  const getInputType = () => {
    if (type === "password") {
      return showPassword ? "text" : "password";
    } else {
      return type;
    }
  };

  const getInputIcon = () => {
    switch (type) {
      case "password":
        return showPassword ? ThemeAssets.eyeOpen : ThemeAssets.eyeClose;
      default:
        return icon;
    }
  };

  const disablePastDates = (current) => {
    return current && current < dayjs().add(startDate, "day").startOf("day");
  };

  const baseInputWrapperClasses =
    "relative flex items-center gap-3 rounded-lg bg-black/[0.02] px-4 py-2.5 h-[50px] overflow-hidden outline outline-[#C240CC] focus-within:outline focus-within:outline-[#308748]";
  const baseInputClass =
    "w-full h-full pr-6 bg-transparent border-none outline-none text-black text-md font-normal font-inter placeholder:text-[#c9c4c4]";
  const errorInputClass =
    "relative rounded-lg bg-black/[0.02] px-4 py-2.5 h-[50px] overflow-hidden outline outline-crimson focus-within:outline focus-within:outline-[#308748]";

  return (
    <div className={`flex flex-col gap-2 ${error ? "error" : ""} ${className}`}>
      {label && (
        <label className={`text-sm font-medium font-inter ${labelClass}`}>
          {label}
          {required && <span className="text-crimson"> *</span>}
        </label>
      )}

      {type === "date" ? (
        <DatePicker
          onChange={onChange}
          className={`h-[50px] bg-black/[0.02] border-none hover:bg-black/[0.02] hover:border-none hover:outline-transparent focus:shadow-none focus-within:outline focus-within:outline-[#308748]   ${inputClass}`}
          disabledDate={disablePastDates}
          popupClassName="date-picker-popup [&_.ant-picker-cell-today_.ant-picker-cell-inner::before]:border-[red] [&_.ant-picker-cell-selected_.ant-picker-cell-inner]:bg-[#308748]"
          style={inputStyle}
          format="DD/MM/YYYY"
        />
      ) : (
        <div
          className={`${baseInputWrapperClasses} ${wrapperClass} ${
            errorMessage && errorInputClass
          } ${disabled ? "bg-[#6b6b6b31]" : ""}`}
          style={inputStyle}
        >
          {iconStart && <img src={iconStart} alt="ss" className="size-5" />}

          <input
            autoComplete="off"
            type={getInputType()}
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            className={`${baseInputClass} ${inputClass}`}
            disabled={disabled}
            maxLength={maxLength}
            placeholder={placeholder}
          />
          {/* <label className={`text-capitalize ${labelClass}`}>{placeholder}</label> */}
          {icon && (
            <img
              src={getInputIcon()}
              alt="icon"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 cursor-pointer"
              onClick={togglePassword}
            />
          )}
        </div>
      )}
      {errorMessage && (
        <p className="text-xs font-medium text-red-600">{errorMessage}</p>
      )}
    </div>
  );
};

export default Input;
