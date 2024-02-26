# SwapLibrary

SwapLibrary is a Solidity library that provides functions for executing token swaps using different protocols. It currently supports Uniswap protocol.

## Functions

### exactInput

Executes an exact input swap.

_Parameters_

- `swapConfig`: Swap configuration including the protocol to use for the swap.
- `tokenIn`: The address of the token to be used as input for the swap.
- `tokenOut`: The address of the token to be received as a result of the swap.
- `amount`: The exact amount of input tokens to be swapped.
- `price`: Approximate amount of units of tokenInrequired to acquire a unit oftokenOut. It will be validated against the swap rate considering the maxSlippage.

### exactOutput

Executes an exact output swap.

_Parameters_

- `swapConfig`: Swap configuration including the protocol to use for the swap.
- `tokenIn`: The address of the token to be used as input for the swap.
- `tokenOut`: The address of the token to be received as a result of the swap.
- `amount`: The desired amount of output tokens to be obtained from the swap.
- `price`: Approximate amount of units of tokenInrequired to acquire a unit oftokenOut. It will be validated against the swap rate considering the maxSlippage.
