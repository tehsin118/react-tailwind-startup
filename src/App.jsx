import React, { useState } from "react";
import Input from "./components/common/input";
import Button from "./components/common/button";

const App = () => {
  return (
    <div className="container space-y-10">
      <Button text="Hello" />
      <div className="flex">
        <Input type="date" />
        <Input className="w-1/2" errorMessage="asd" />
      </div>
      <Input className="w-1/2" />
      <Button text="Hello" variant="secondary" />
      <Button text="Hello wordl" variant="secondary" />
    </div>
  );
};

export default App;
