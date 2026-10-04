# Ollama Setup

LocalCommit requires Ollama to be installed and running locally. If the
`ollama` command is not found, install Ollama for your operating system using
one of the options below.

## Windows

Download and run the installer from [ollama.com/download/windows](https://ollama.com/download/windows).

After installation, open PowerShell and verify it:

```powershell
ollama --version
```

## macOS

Download and install the application from [ollama.com/download/mac](https://ollama.com/download/mac).

Alternatively, with Homebrew:

```bash
brew install --cask ollama
```

Verify the installation:

```bash
ollama --version
```

## Linux

### Debian or Ubuntu

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Fedora

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

If you prefer the Fedora package manager, check the current package name and
availability in your configured repositories before installing it.

### Arch Linux

```bash
sudo pacman -S ollama
```

If the package is not available in your enabled repositories, use the Linux
installation script above or install the current package from the Arch User
Repository.

Verify the installation on Linux:

```bash
ollama --version
```

## Start Ollama and install a model

Start the Ollama server in a separate terminal:

```bash
ollama serve
```

LocalCommit reads its model from the `model` file at the project root (default: `qwen2.5-coder:3b`), so install that model:

```bash
ollama pull qwen2.5-coder:3b
```

To use a different model, edit the `model` file or set the environment variable `LOCALCOMMIT_MODEL=`.

You can also run the project setup command. It checks for the Ollama server
and downloads `qwen2.5-coder:3b` if that model is missing:

```bash
npm run setup
```

## Check models

List all installed models:

```bash
ollama list
```

Check which models are currently loaded in RAM/VRAM:

```bash
ollama ps
```

## Remove a model

Remove a model to free disk space:

```bash
ollama rm $(cat model)
```