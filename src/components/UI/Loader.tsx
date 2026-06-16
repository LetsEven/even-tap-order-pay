import React from "react";

const Loader = () => {
  return (
    <div className="fixed inset-0 z-50 bg-[#023828] flex items-center justify-center">
      <div className="text-center">
        <div>
          <img
            src="/brand/even-asterisk-grass.svg"
            alt="Even"
            className="asterisk-spin w-28 h-28 md:w-36 md:h-36 justify-self-center"
          />
        </div>
      </div>
    </div>
  );
};

export default Loader;
