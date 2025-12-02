import React from "react";

const Checkbox = ({
  id,
  name,
  label,
  labelClass,
  disabled = false,
  checked,
  onChange,
  image,
  className,
}) => {
  return (
    <div className={`checkbox-wrapper flex  items-center gap-2 ${className}`}>
      <input
        id={id}
        name={name}
        type="checkbox"
        disabled={disabled}
        checked={checked}
        onChange={onChange}
      />
      {/* Image before label */}
      <label className="cbx font-medium" htmlFor={id}></label>
      {image && <img src={image} alt={label} />}
      <label className={`lbl font-medium ${labelClass}`} htmlFor={id}>
        {label}
      </label>
    </div>
  );
};

export default Checkbox;
