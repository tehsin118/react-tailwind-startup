import React, { useState } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import ThemeAssets from "../../assets/themeAssets";

const Input = ({
  type = "text",
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
  maxLength,
  error,
  errorMessage,
  disabled = false,
  required = false,
  startDate = 1,
  iconStart,
}) => {
  const [showPassword, setShowPassword] = useState(false);

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

  const wrapperClass =
    "relative flex items-center gap-3 rounded-md px-4 py-2.5   overflow-hidden outline outline-[#e9e9e9]";
  const focusStyle =
    "focus-within:outline focus-within:outline-[#308748] hover:outline-[#308748]";
  const baseStyle = `w-full h-full bg-transparent border-none outline-none text-black text-sm font-light font-inter placeholder:text-[#e9e9e9] ${
    icon && "pr-6"
  }`;

  const errorInputClass =
    "bg-crimson/10 outline outline-crimson focus-within:outline focus-within:outline-[#308748]";

  return (
    <div className={`flex flex-col gap-2 ${error ? "error" : ""} ${className}`}>
      {label && (
        <label className={`text-sm font-inter ${labelClass}`}>
          {label}
          {required && <span className="text-crimson"> *</span>}
        </label>
      )}

      {type === "date" ? (
        <div
          className={` ${wrapperClass} ${focusStyle}  ${className} ${
            errorMessage && errorInputClass
          } ${disabled ? "bg-[#6b6b6b31]" : ""}`}
        >
          <DatePicker
            onChange={onChange}
            className={`!p-0 focus:shadow-none focus:outline-none focus-within:outline-none focus-within:shadow-none ${inputClass}`}
            disabledDate={disablePastDates}
            rootClassName="!border-none !shadow-none !outline-none [&_input]:!leading-[0] [&_.ant-picker-input]:!shadow-none [&_.ant-picker-input]:!outline-none"
            classNames={{
              popup: {
                root: "date-picker-popup [&_.ant-picker-cell-today_.ant-picker-cell-inner::before]:border-[red] [&_.ant-picker-cell-selected_.ant-picker-cell-inner]:bg-[#308748]",
              },
            }}
            format="DD/MM/YYYY"
          />{" "}
        </div>
      ) : (
        <div
          className={`${wrapperClass} ${focusStyle} ${className} ${
            errorMessage && errorInputClass
          } ${disabled ? "bg-[#6b6b6b31]" : ""}`}
        >
          {iconStart && <img src={iconStart} alt="ss" className="size-5" />}

          <input
            autoComplete="off"
            type={getInputType()}
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            className={`${baseStyle} ${inputClass}`}
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
