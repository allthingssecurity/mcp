# MCP Setup Instructions

Follow these steps to set up the Multi-Component Platform (MCP) on Windows.

---

## **Prerequisites**

1. **Claude Desktop**: Download and install Claude Desktop.
2. **Node.js**: Ensure Node.js and npm are installed on your system.

---

## **Setup Steps**

### **1. Install Claude Desktop**

1. Download the latest version of Claude Desktop from the official source.
2. Install it on your system.

### **2. Configure Claude Desktop**

1. Locate the `claude_desktop_config.json` configuration file.
   - The file should include all required environment variables like `exa key` for search functionality.

2. Copy the configuration file to:
   ```
   C:\Users\<YourUsername>\AppData\Roaming\Claude
   ```
   Replace `<YourUsername>` with your actual Windows username.

### **3. Verify Node.js and npm Installation**

1. Check if Node.js is installed by running:
   ```
   node -v
   ```

2. Check if npm is installed by running:
   ```
   npm -v
   ```

3. If not installed, download and install Node.js from [https://nodejs.org](https://nodejs.org).

### **4. Finalize Setup**

1. Launch Claude Desktop and verify it loads correctly with the provided configuration.
2. Test MCP functionalities to ensure everything is working as expected.

---

## **Environment Variables**

Ensure the `claude_desktop_config.json` file includes the following variables:

- `exa_key`: Your key for search functionality.
- Other required keys or settings as specified in the project documentation.

---

## **Troubleshooting**

1. **Configuration Errors**: Double-check the path to `claude_desktop_config.json`.
2. **Node.js Issues**: Ensure the correct version of Node.js is installed.
3. **Missing Dependencies**: Use npm to install any required dependencies for MCP.
   ```
   npm install
   ```

---

For further assistance, refer to the project documentation or contact support.

## **Z3 setup**
Install node z3 module before using the MCP Z3 server.
