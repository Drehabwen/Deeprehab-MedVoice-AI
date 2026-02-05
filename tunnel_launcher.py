import subprocess
import sys

def start_tunnel():
    print("Starting Cloudflare Tunnel...")
    cmd = ["cloudflared", "tunnel", "--url", "http://localhost:5001"]
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    
    for line in process.stdout:
        print(line, end='')
        if "trycloudflare.com" in line:
            # Found the URL, we can keep printing or just continue
            pass

if __name__ == "__main__":
    start_tunnel()
