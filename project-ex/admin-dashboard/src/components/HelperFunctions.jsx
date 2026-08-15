export const formatBigNumber = (value) => {
  const num = Number(value) || 0;

  const format = (n) => {
    // Integer → no decimals
    if (Number.isInteger(n)) {
      return n.toString();
    }

    // Up to 2 decimals, removing trailing zeros
    return n.toFixed(2).replace(/\.?0+$/, "");
  };

  if (Math.abs(num) >= 1_000_000_000) {
    return {
      value: format(num / 1_000_000_000),
      suffix: "B",
    };
  }

  if (Math.abs(num) >= 1_000_000) {
    return {
      value: format(num / 1_000_000),
      suffix: "M",
    };
  }

  if (Math.abs(num) >= 1_000) {
    return {
      value: format(num / 1_000),
      suffix: "K",
    };
  }

  return {
    value: format(num),
    suffix: "",
  };
};

export const getNumberSuffixColor = (suffix) => {
  switch (suffix) {
    case "K":
      return "#3a8bed"; // blue
    case "M":
      return "#357a10"; // green
    case "B":
      return "#f59e0b"; // orange
    default:
      return "inherit";
  }
};