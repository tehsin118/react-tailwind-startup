import React, { useState } from "react";
import Input from "./components/common/input";
import Button from "./components/common/button";
import CustomSelect from "./components/common/select";

const App = () => {
  return (
    <div className="container space-y-10">
      <Button text="Hello" />
      <Input type="date" />
      <Input className="w-1/2" errorMessage="asd" />
      <div className="flex">
        <CustomSelect label="select" />
        <Input className="w-1/2" label="select" />
      </div>
      <Button text="Hello" variant="secondary" />
      <Button text="Hello wordl" variant="secondary" />
    </div>
  );
};

export default App;
