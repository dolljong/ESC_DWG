import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import NavigationToolbar2Tk

# Test if NavigationToolbar2Tk is available
print("NavigationToolbar2Tk is available:", hasattr(NavigationToolbar2Tk, '__init__'))

# Test zoom functionality
fig, ax = plt.subplots()
ax.plot([1, 2, 3], [1, 4, 9])
ax.set_title("Test Plot - Use mouse wheel to zoom")

def on_scroll(event):
    cur_xlim = ax.get_xlim()
    cur_ylim = ax.get_ylim()
    xdata = event.xdata
    ydata = event.ydata
    
    if xdata is None or ydata is None:
        return
    
    if event.button == 'up':
        scale_factor = 0.9
    elif event.button == 'down':
        scale_factor = 1.1
    else:
        scale_factor = 1
    
    new_width = (cur_xlim[1] - cur_xlim[0]) * scale_factor
    new_height = (cur_ylim[1] - cur_ylim[0]) * scale_factor
    
    relx = (cur_xlim[1] - xdata) / (cur_xlim[1] - cur_xlim[0])
    rely = (cur_ylim[1] - ydata) / (cur_ylim[1] - cur_ylim[0])
    
    ax.set_xlim([xdata - new_width * (1 - relx), xdata + new_width * relx])
    ax.set_ylim([ydata - new_height * (1 - rely), ydata + new_height * rely])
    
    fig.canvas.draw_idle()

fig.canvas.mpl_connect('scroll_event', on_scroll)
plt.show()

print("Navigation test completed!")