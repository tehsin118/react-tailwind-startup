import React from "react";
// import loader from "../../assets/icons/loading.svg";

const Button = ({
  text,
  img,
  className,
  onClick,
  disabled,
  imgClass,
  loading = false,
  variant = "primary",
}) => {
  const baseClasses =
    "flex justify-center items-center rounded-sm capitalize  px-4 py-2.5 font-medium text-sm cursor-pointer font-montserrat transition-all duration-200 disabled:cursor-not-allowed";

  const variantClasses = {
    primary: "bg-[#C240CC] text-[#f2f2f2] hover:bg-[red] ",
    secondary:
      "bg-transparent text-[#C240CC] hover:bg-[rgba(100,227,107,0.08)] border border-[#C240CC]",
  };

  if (loading) {
    disabled = true;
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className || ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {loading ? (
        <span className="flex justify-center items-center gap-2">{text}</span>
      ) : (
        <>
          <span>{text}</span>
          {img && <img src={img} alt="Button Image" className={imgClass} />}
        </>
      )}
    </button>
  );
};

export default Button;
